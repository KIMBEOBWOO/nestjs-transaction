import { QueryRunner } from 'typeorm';
import {
  addOnCommitListenerToStore,
  addOnRollBackListenerToStore,
  createStore,
  emitOnCommitEvent,
  emitOnRollBackEvent,
  getStore,
  hasActiveTransactionStore,
  TYPEORM_DEFAULT_DATA_SOURCE_NAME,
} from '../common';
import { PropagationType, Propagation, IsolationLevel, IsolationLevelType } from '../enums';
import { TransactionalError } from '../errors';
import { TransactionOptions, Transaction } from '../interfaces';
import { storage, Store } from '../storage';

export const wrapInTransaction = <Fn extends (this: any, ...args: any[]) => ReturnType<Fn>>(
  fn: Fn,
  transaction?: Transaction,
  options?: TransactionOptions,
) => {
  function wrapper(this: unknown, ...args: unknown[]) {
    const runOriginal = () => fn.apply(this, args);
    const propagation: PropagationType = options?.propagation || Propagation.REQUIRED;
    const dataSourceName = options?.connectionName || TYPEORM_DEFAULT_DATA_SOURCE_NAME;
    const isolationLevel: IsolationLevelType =
      options?.isolationLevel || IsolationLevel.READ_COMMITTED;

    const isActive = hasActiveTransactionStore(dataSourceName);
    const store: Store<QueryRunner> = isActive
      ? getStore(dataSourceName)
      : createStore(dataSourceName);

    return storage.run(dataSourceName, store, async () => {
      if (transaction) {
        //add event to event emitter
        addOnCommitListenerToStore(store, transaction);
        addOnRollBackListenerToStore(store, transaction);
      }

      switch (propagation) {
        case Propagation.REQUIRED:
          if (isActive) {
            return await runOriginal();
          } else {
            const queryRunner = store.data as QueryRunner;

            try {
              await queryRunner.startTransaction(isolationLevel);
              const result = await runOriginal();

              await queryRunner.commitTransaction();
              await emitOnCommitEvent(store);

              return result;
            } catch (e) {
              await queryRunner.rollbackTransaction();
              await emitOnRollBackEvent(store);
              throw e;
            } finally {
              await queryRunner.release();
              storage.enterWith(dataSourceName, {
                data: undefined,
                eventEmitter: undefined,
              });
            }
          }
        case Propagation.SUPPORTS:
          const result = await runOriginal();
          await emitOnCommitEvent(store);

          return result;
        default:
          throw new TransactionalError('Not supported propagation type');
      }
    });
  }

  return wrapper as Fn;
};
