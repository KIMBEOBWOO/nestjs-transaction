import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { DataSourceName, TYPEORM_DEFAULT_DATA_SOURCE_NAME } from '../common';
import { IsolationLevel, IsolationLevelType, Propagation, PropagationType } from '../enums';
import { NotRollBackError, TransactionalError } from '../errors';
import { TransactionOptions } from '../interfaces';
import { storage } from '../storage';
import { emitAsyncOnCommitEvent, emitAsyncOnRollBackEvent } from '../transactions';

export abstract class TransactionDemacrcation {
  async runInTransactionDemacrcation(
    fn: () => Promise<unknown>,
    options?: TransactionOptions,
  ): Promise<unknown> {
    const dataSourceName = options?.connectionName || TYPEORM_DEFAULT_DATA_SOURCE_NAME;
    const isolationLevel: IsolationLevelType =
      options?.isolationLevel || IsolationLevel.READ_COMMITTED;

    try {
      await this.startTransaction(dataSourceName, isolationLevel);
      const result = await fn();
      await this.commitTransaction(dataSourceName);

      return result;
    } catch (e) {
      await this.rollbackTransaction(dataSourceName, e);
    } finally {
      await this.finishTransaction(dataSourceName);
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
    dataSourceName: DataSourceName,
    isolationLevel: IsolationLevelType,
  ): unknown;
  protected abstract commitTransaction(dataSourceName: DataSourceName): unknown;
  protected abstract rollbackTransaction(dataSourceName: DataSourceName, e: unknown): unknown;
  protected abstract finishTransaction(dataSourceName: DataSourceName): unknown;
}

@Injectable()
export class NewTransactionDemacrcation extends TransactionDemacrcation {
  override async startTransaction(
    dataSourceName: DataSourceName,
    isolationLevel: IsolationLevelType,
  ) {
    const connection = await this.getConnection(dataSourceName);
    await connection.startTransaction(isolationLevel);
  }

  protected override async commitTransaction(dataSourceName: DataSourceName) {
    const connection = await this.getConnection(dataSourceName);
    await connection.commitTransaction();
    await emitAsyncOnCommitEvent();
  }

  protected override async rollbackTransaction(dataSourceName: DataSourceName, e: unknown) {
    if (e instanceof NotRollBackError) {
      throw e.originError;
    }

    const connection = await this.getConnection(dataSourceName);
    await connection.rollbackTransaction();
    await emitAsyncOnRollBackEvent(e);
    throw e;
  }

  protected override async finishTransaction(dataSourceName: DataSourceName) {
    const connection = await this.getConnection(dataSourceName);
    await connection.release();
    storage.set(dataSourceName, undefined);
  }
}

@Injectable()
export class WrapTransactionDemacrcation extends NewTransactionDemacrcation {
  protected override async commitTransaction(dataSourceName: string): Promise<void> {
    const connection = await this.getConnection(dataSourceName);
    await connection.commitTransaction();
  }

  protected override async rollbackTransaction(dataSourceName: DataSourceName, e: unknown) {
    const connection = await this.getConnection(dataSourceName);
    await connection.rollbackTransaction();
    throw new NotRollBackError(e);
  }

  protected override async finishTransaction() {
    return;
  }
}

@Injectable()
export class RunOriginalTransactionDemacrcation extends TransactionDemacrcation {
  protected startTransaction() {
    return;
  }

  protected commitTransaction() {
    return;
  }

  protected rollbackTransaction() {
    return;
  }

  protected finishTransaction() {
    return;
  }
}

@Injectable()
export class RunOriginalAndEventTransactionDemacrcation extends TransactionDemacrcation {
  protected startTransaction() {
    return;
  }

  protected async commitTransaction() {
    await emitAsyncOnCommitEvent();
  }

  protected rollbackTransaction() {
    return;
  }

  protected finishTransaction() {
    return;
  }
}

@Injectable()
export class TransactionDemacrcationFactory {
  constructor(
    private readonly newTransactionDemacrcation: TransactionDemacrcation,
    private readonly runOriginalAndEventTransactionDemacrcation: TransactionDemacrcation,
    private readonly runOriginalTransactionDemacrcation: TransactionDemacrcation,
    private readonly wrapTransactionDemacrcation: TransactionDemacrcation,
  ) {}

  getInstance(propagation: PropagationType, isActive: boolean): TransactionDemacrcation {
    switch (propagation) {
      case Propagation.NESTED:
        if (isActive) {
          return this.wrapTransactionDemacrcation;
        } else {
          return this.newTransactionDemacrcation;
        }
      case Propagation.REQUIRED:
        if (isActive) {
          return this.runOriginalTransactionDemacrcation;
        } else {
          return this.newTransactionDemacrcation;
        }
      case Propagation.SUPPORTS:
        if (isActive) {
          return this.runOriginalTransactionDemacrcation;
        } else {
          return this.runOriginalAndEventTransactionDemacrcation;
        }
      default:
        throw new TransactionalError('Not supported propagation type');
    }
  }
}
