import { QueryRunner } from 'typeorm';
import { getDataSource, TYPEORM_DEFAULT_DATA_SOURCE_NAME } from '../common';
import { PropagationType, Propagation, IsolationLevel, IsolationLevelType } from '../enums';
import { NotRollBackError, TransactionalError } from '../errors';
import { TransactionOptions } from '../interfaces';
import { storage } from '../storage';
import { emitAsyncOnCommitEvent, emitAsyncOnRollBackEvent } from './transaciton-hooks';

export const wrapInTransaction = <Fn extends (this: any, ...args: any[]) => ReturnType<Fn>>(
  fn: Fn,
  options?: TransactionOptions,
) => {
  function wrapper(this: unknown, ...args: unknown[]) {
    const runOriginal = () => fn.apply(this, args);
    const propagation: PropagationType = options?.propagation || Propagation.REQUIRED;
    const dataSourceName = options?.connectionName || TYPEORM_DEFAULT_DATA_SOURCE_NAME;
    const isolationLevel: IsolationLevelType =
      options?.isolationLevel || IsolationLevel.READ_COMMITTED;

    return storage.run(async () => {
      const storedQueryRunner = storage.get<QueryRunner | undefined>(dataSourceName);
      const isTransactionActive =
        storedQueryRunner !== undefined && storedQueryRunner.isTransactionActive;

      switch (propagation) {
        case Propagation.NESTED:
          if (isTransactionActive) {
            const queryRunner = storage.get<QueryRunner>(dataSourceName);
            if (!queryRunner)
              throw new TransactionalError(
                'AsyncLocalStorage throw system error, please re-run your application',
              );

            try {
              await queryRunner.startTransaction(isolationLevel);
              const result = await runOriginal();

              await queryRunner.commitTransaction();

              return result;
            } catch (e) {
              await queryRunner.rollbackTransaction();
              throw new NotRollBackError(e);
            }
          } else {
            const queryRunner = getDataSource(dataSourceName).createQueryRunner();
            storage.set(dataSourceName, queryRunner);

            try {
              await queryRunner.startTransaction(isolationLevel);
              const result = await runOriginal();

              await queryRunner.commitTransaction();
              await emitAsyncOnCommitEvent();

              return result;
            } catch (e) {
              if (e instanceof NotRollBackError) {
                await queryRunner.commitTransaction();
                throw e.originError;
              } else {
                await queryRunner.rollbackTransaction();
                await emitAsyncOnRollBackEvent(e);
                throw e;
              }
            } finally {
              await queryRunner.release();
              storage.set(dataSourceName, undefined);
            }
          }
        case Propagation.REQUIRED:
          if (isTransactionActive) {
            return runOriginal();
          } else {
            const queryRunner = getDataSource(dataSourceName).createQueryRunner();
            storage.set(dataSourceName, queryRunner);

            try {
              await queryRunner.startTransaction(isolationLevel);
              const result = await runOriginal();

              await queryRunner.commitTransaction();
              await emitAsyncOnCommitEvent();

              return result;
            } catch (e) {
              if (e instanceof NotRollBackError) {
                await queryRunner.commitTransaction();
                throw e.originError;
              } else {
                await queryRunner.rollbackTransaction();
                await emitAsyncOnRollBackEvent(e);
                throw e;
              }
            } finally {
              await queryRunner.release();
              storage.set(dataSourceName, undefined);
            }
          }
        case Propagation.SUPPORTS:
          try {
            const result = await runOriginal();

            if (isTransactionActive) return result;
            else {
              await emitAsyncOnCommitEvent();
              return result;
            }
          } catch (e) {
            if (e instanceof NotRollBackError) {
              throw e.originError;
            }

            throw e;
          }
        case Propagation.REQUIRES_NEW:
          const queryRunner = getDataSource(dataSourceName).createQueryRunner();
          storage.set(dataSourceName, queryRunner);

          try {
            await queryRunner.startTransaction(isolationLevel);

            const result = await runOriginal();

            await queryRunner.commitTransaction();
            await emitAsyncOnCommitEvent();

            return result;
          } catch (e) {
            if (e instanceof NotRollBackError) {
              await queryRunner.commitTransaction();
              await emitAsyncOnCommitEvent();
              throw e.originError;
            } else {
              await queryRunner.rollbackTransaction();
              await emitAsyncOnRollBackEvent(e);

              if (!isTransactionActive) throw e;
              throw new NotRollBackError(e);
            }
          } finally {
            await queryRunner.release();
            storage.set(dataSourceName, undefined);
          }
        default:
          throw new TransactionalError('Not supported propagation type');
      }
    });
  }

  return wrapper as Fn;
};
