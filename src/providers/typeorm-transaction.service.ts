import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { getDataSource, TYPEORM_DEFAULT_DATA_SOURCE_NAME } from '../common';
import { IsolationLevel, IsolationLevelType } from '../enums';
import { ExecutableTransaction, TransactionOptions } from '../interfaces';
import { Store, storage } from '../storage';

@Injectable()
export class TypeORMTransactionService implements ExecutableTransaction {
  private static instance: ExecutableTransaction;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor() {}

  public static getInstance() {
    if (!TypeORMTransactionService.instance) {
      TypeORMTransactionService.instance = new TypeORMTransactionService();
    }
    return TypeORMTransactionService.instance;
  }

  isActive(options?: TransactionOptions): boolean {
    const dataSourceName = options?.connectionName || TYPEORM_DEFAULT_DATA_SOURCE_NAME;
    const store = storage.getContext(dataSourceName);

    return (
      store !== undefined &&
      store.data !== undefined &&
      (store.data as QueryRunner)?.isTransactionActive
    );
  }

  joinInCurrentTransaction(runOriginal: () => any, options?: TransactionOptions) {
    const dataSourceName = options?.connectionName || TYPEORM_DEFAULT_DATA_SOURCE_NAME;

    const store = storage.getContext(dataSourceName);
    return storage.run(dataSourceName, store, () => runOriginal());
  }

  runInNewTransaction(runOriginal: () => any, options?: TransactionOptions) {
    const dataSourceName = options?.connectionName || TYPEORM_DEFAULT_DATA_SOURCE_NAME;
    const isolationLevel: IsolationLevelType =
      options?.isolationLevel || IsolationLevel.READ_COMMITTED;

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
}
