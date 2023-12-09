import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { DataSourceName } from '../common';
import { IsolationLevelType } from '../enums';
import { NotRollBackError, TransactionalError } from '../errors';
import { storage } from '../storage';
import { emitAsyncOnCommitEvent, emitAsyncOnRollBackEvent } from '../transactions';

export abstract class TransactionDemacrcation {
  async runInTransactionDemacrcation(
    fn: () => Promise<unknown>,
    dataSourceName: DataSourceName,
    isolationLevel: IsolationLevelType,
  ): Promise<unknown> {
    const connection = await this.getConnection(dataSourceName);

    try {
      await this.startTransaction(connection, isolationLevel);
      const result = await fn();
      await this.commitTransaction(connection);

      return result;
    } catch (e) {
      await this.rollbackTransaction(connection, e);
    } finally {
      await this.finishTransaction(connection, dataSourceName);
    }
  }

  protected async getConnection(dataSourceName: DataSourceName) {
    const queryRunner = storage.get<QueryRunner>(dataSourceName);

    if (!queryRunner) {
      throw new TransactionalError(
        'AsyncLocalStorage throw system error, please re-run your application',
      );
    }

    return queryRunner;
  }

  protected abstract startTransaction(
    queryRunner: QueryRunner,
    isolationLevel: IsolationLevelType,
  ): Promise<void>;
  protected abstract commitTransaction(queryRunner: QueryRunner): Promise<void>;
  protected abstract rollbackTransaction(queryRunner: QueryRunner, e: unknown): Promise<void>;
  protected abstract finishTransaction(
    queryRunner: QueryRunner,
    dataSourceName: DataSourceName,
  ): Promise<void>;
}

@Injectable()
export class NewTransactionDemacrcation extends TransactionDemacrcation {
  override async startTransaction(queryRunner: QueryRunner, isolationLevel: IsolationLevelType) {
    await queryRunner.startTransaction(isolationLevel);
  }

  protected override async commitTransaction(queryRunner: QueryRunner) {
    await queryRunner.commitTransaction();
    await emitAsyncOnCommitEvent();
  }

  protected override async rollbackTransaction(queryRunner: QueryRunner, e: unknown) {
    if (e instanceof NotRollBackError) {
      throw e.originError;
    }

    await queryRunner.rollbackTransaction();
    await emitAsyncOnRollBackEvent(e);
    throw e;
  }

  protected override async finishTransaction(
    queryRunner: QueryRunner,
    dataSourceName: DataSourceName,
  ) {
    await queryRunner.release();
    storage.set(dataSourceName, undefined);
  }
}
