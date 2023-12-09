import { QueryRunner } from 'typeorm';
import { getDataSource, TYPEORM_DEFAULT_DATA_SOURCE_NAME } from '../common';
import { PropagationType, Propagation } from '../enums';
import { TransactionOptions } from '../interfaces';
import { TransactionDemacrcationFactory } from '../providers';
import { storage } from '../storage';

export const wrapInTransaction = <Fn extends (this: any, ...args: any[]) => ReturnType<Fn>>(
  fn: Fn,
  options?: TransactionOptions,
  demacrcationFactory?: TransactionDemacrcationFactory,
) => {
  function wrapper(this: unknown, ...args: unknown[]) {
    const runOriginal = () => fn.apply(this, args);
    const propagation: PropagationType = options?.propagation || Propagation.REQUIRED;
    const dataSourceName = options?.connectionName || TYPEORM_DEFAULT_DATA_SOURCE_NAME;

    if (!demacrcationFactory) {
      throw new Error('demacrcationFactory is required');
    }

    return storage.run(() => {
      const storedQueryRunner = storage.get<QueryRunner | undefined>(dataSourceName);
      const isTransactionActive =
        storedQueryRunner !== undefined && storedQueryRunner.isTransactionActive;

      if (!isTransactionActive) {
        storage.set(dataSourceName, getDataSource(dataSourceName).createQueryRunner());
      }

      const demacrcation = demacrcationFactory.getInstance(propagation, isTransactionActive);
      return demacrcation.runInTransactionDemacrcation(runOriginal, options);
    });
  }

  return wrapper as Fn;
};
