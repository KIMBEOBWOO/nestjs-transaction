import { QueryRunner } from 'typeorm';
import { TYPEORM_DEFAULT_DATA_SOURCE_NAME, getDataSource } from '../common';
import { PropagationType, Propagation, IsolationLevelType, IsolationLevel } from '../enums';
import { TransactionOptions } from '../interfaces';
import { storage, Store } from '../storage';

const isTransactionActive = (store?: Store<unknown | undefined>): store is Store<QueryRunner> =>
  store !== undefined &&
  store.data !== undefined &&
  (store.data as QueryRunner)?.isTransactionActive;

export const wrapInTransaction = <Fn extends (this: any, ...args: any[]) => ReturnType<Fn>>(
  fn: Fn,
  options?: TransactionOptions,
) => {
  function wrapper(this: unknown, ...args: unknown[]) {
    const dataSourceName = options?.connectionName || TYPEORM_DEFAULT_DATA_SOURCE_NAME;

    const propagation: PropagationType = options?.propagation || Propagation.REQUIRED;

    const isolationLevel: IsolationLevelType =
      options?.isolationLevel || IsolationLevel.READ_COMMITTED;

    const store = storage.getContext(dataSourceName);

    const runOriginal = () => fn.apply(this, args);

    switch (propagation) {
      case Propagation.REQUIRED:
        if (isTransactionActive(store)) {
          return storage.run(dataSourceName, store, () => runOriginal());
        } else {
          const queryRunner = getDataSource(dataSourceName).createQueryRunner();

          const newStore: Store<QueryRunner> = {
            data: queryRunner,
          };

          return storage.run(dataSourceName, newStore, async () => {
            await queryRunner.startTransaction(isolationLevel);

            try {
              const result = await runOriginal();
              await queryRunner.commitTransaction();
              return result;
            } catch (e) {
              await queryRunner.rollbackTransaction();
              throw e;
            } finally {
              await queryRunner.release();
            }
          });
        }
      case Propagation.SUPPORTS:
        if (isTransactionActive(store)) {
          return storage.run(dataSourceName, store, () => runOriginal());
        } else {
          return runOriginal();
        }
    }
  }

  return wrapper as Fn;
};
