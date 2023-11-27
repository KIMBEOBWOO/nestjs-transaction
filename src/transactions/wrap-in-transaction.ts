import { QueryRunner } from 'typeorm';
import { getDataSource, TYPEORM_DEFAULT_DATA_SOURCE_NAME } from '../common';
import { PropagationType, Propagation, IsolationLevel, IsolationLevelType } from '../enums';
import { TransactionalError } from '../errors';
import { TransactionOptions, Transaction } from '../interfaces';
import { storage } from '../storage';

function isActive(options?: TransactionOptions): boolean {
  const dataSourceName = options?.connectionName || TYPEORM_DEFAULT_DATA_SOURCE_NAME;
  const store = storage.getContext(dataSourceName);

  return (
    store !== undefined &&
    store.data !== undefined &&
    (store.data as QueryRunner)?.isTransactionActive
  );
}

export const wrapInTransaction = <Fn extends (this: any, ...args: any[]) => ReturnType<Fn>>(
  fn: Fn,
  transaction: Transaction,
  options?: TransactionOptions,
) => {
  function wrapper(this: unknown, ...args: unknown[]) {
    const runOriginal = () => fn.apply(this, args);
    const propagation: PropagationType = options?.propagation || Propagation.REQUIRED;
    const dataSourceName = options?.connectionName || TYPEORM_DEFAULT_DATA_SOURCE_NAME;
    const store = storage.getContext(dataSourceName) || {
      data: getDataSource(dataSourceName).createQueryRunner(),
    };

    switch (propagation) {
      case Propagation.REQUIRED:
        if (isActive(options)) {
          return storage.run(dataSourceName, store, runOriginal);
        } else {
          const isolationLevel: IsolationLevelType =
            options?.isolationLevel || IsolationLevel.READ_COMMITTED;
          const queryRunner = store.data as QueryRunner;

          return storage.run(dataSourceName, store, async () => {
            await queryRunner.startTransaction(isolationLevel);

            try {
              const result = await runOriginal();

              await transaction.onCommit(queryRunner);

              return result;
            } catch (e) {
              await transaction.onRollBack(queryRunner);
            } finally {
              await queryRunner.release();
            }
          });
        }
      case Propagation.SUPPORTS:
        return runOriginal();
      default:
        throw new TransactionalError('Not supported propagation type');
    }
  }

  return wrapper as Fn;
};
