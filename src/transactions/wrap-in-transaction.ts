import { QueryRunner } from 'typeorm';
import { DEFAULT_DATA_SOURCE_NAME, getDataSource } from '../common';
import { PropagationType, Propagation, IsolationLevelType, IsolationLevel } from '../enums';
import { TransactionOptions } from '../interfaces';
import { storage, Store } from '../storage';

export const wrapInTransaction = <Fn extends (this: any, ...args: any[]) => ReturnType<Fn>>(
  fn: Fn,
  options?: TransactionOptions,
) => {
  function wrapper(this: unknown, ...args: unknown[]) {
    const store = storage.getStore();

    const dataSourceName = options?.connectionName || DEFAULT_DATA_SOURCE_NAME;

    const propagation: PropagationType = options?.propagation || Propagation.REQUIRED;

    const isolationLevel: IsolationLevelType =
      options?.isolationLevel || IsolationLevel.READ_COMMITTED;

    const runOriginal = () => fn.apply(this, args);

    switch (propagation) {
      case Propagation.REQUIRED:
        if (!store) {
          const queryRunner = getDataSource(dataSourceName).createQueryRunner();
          const newStore: Store<QueryRunner> = {
            seqId: Date.now().toString(),
            data: queryRunner,
          };

          return storage.run(newStore, async () => {
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
        } else {
          return storage.run(store, () => runOriginal());
        }
      case Propagation.SUPPORTS:
        if (store) {
          return storage.run(store, () => runOriginal());
        } else {
          return runOriginal();
        }
    }
  }

  return wrapper as Fn;
};
