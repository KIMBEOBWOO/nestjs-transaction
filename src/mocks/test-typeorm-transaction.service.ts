import { Inject, Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { TYPEORM_DEFAULT_DATA_SOURCE_NAME, getTestQueryRunnerToken } from '../common';
import { IsolationLevelType, IsolationLevel } from '../enums';
import { TransactionOptions } from '../interfaces';
import { TypeORMTransactionService } from '../providers/typeorm-transaction.service';
import { Store, storage } from '../storage';

@Injectable()
export class TestTypeORMTransactionService extends TypeORMTransactionService {
  constructor(
    @Inject(getTestQueryRunnerToken())
    private readonly testQueryRunner: QueryRunner,
  ) {
    super();
  }

  override runInNewTransaction(runOriginal: () => any, options?: TransactionOptions) {
    const dataSourceName = options?.connectionName || TYPEORM_DEFAULT_DATA_SOURCE_NAME;
    const isolationLevel: IsolationLevelType =
      options?.isolationLevel || IsolationLevel.READ_COMMITTED;

    const queryRunner = this.testQueryRunner;

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
      }
    });
  }
}
