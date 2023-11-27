import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { TYPEORM_DEFAULT_DATA_SOURCE_NAME } from '../common';
import { IsolationLevelType } from '../enums';
import { ExecutableTransaction, TransactionOptions } from '../interfaces';
import { storage } from '../storage';

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

  joinInCurrentTransaction(runOriginal: () => Promise<any>) {
    return runOriginal();
  }

  async runInNewTransaction(
    runOriginal: () => Promise<any>,
    queryRunner: QueryRunner,
    isolationLevel: IsolationLevelType,
  ) {
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
  }
}
