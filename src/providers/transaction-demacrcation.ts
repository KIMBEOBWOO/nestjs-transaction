import { Injectable } from '@nestjs/common';
import { DataSourceName, TYPEORM_DEFAULT_DATA_SOURCE_NAME } from '../common';
import { IsolationLevel, IsolationLevelType } from '../enums';
import { NotRollBackError } from '../errors';
import { TransactionOptions } from '../interfaces';
import { storage } from '../storage';
import { emitAsyncOnCommitEvent, emitAsyncOnRollBackEvent } from '../transactions';
import { Connection, ConnectionManager } from './connection-manager';

export abstract class TransactionDemacrcation {
  constructor(private readonly connectionManager: ConnectionManager) {}

  async runInTransactionDemacrcation(
    fn: () => Promise<unknown>,
    options?: TransactionOptions,
  ): Promise<unknown> {
    const dataSourceName = options?.connectionName || TYPEORM_DEFAULT_DATA_SOURCE_NAME;
    const isolationLevel: IsolationLevelType =
      options?.isolationLevel || IsolationLevel.READ_COMMITTED;
    const connection = this.connectionManager.getConnection(dataSourceName);

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

  protected abstract startTransaction(
    connection: Connection,
    isolationLevel: IsolationLevelType,
  ): unknown;
  protected abstract commitTransaction(connection: Connection): unknown;
  protected abstract rollbackTransaction(connection: Connection, e: unknown): unknown;
  protected abstract finishTransaction(
    connection: Connection,
    dataSourceName: DataSourceName,
  ): unknown;
}

@Injectable()
export class NewTransactionDemacrcation extends TransactionDemacrcation {
  override async startTransaction(conneciton: Connection, isolationLevel: IsolationLevelType) {
    await conneciton.startTransaction(isolationLevel);
  }

  protected override async commitTransaction(connection: Connection) {
    await connection.commitTransaction();
    await emitAsyncOnCommitEvent();
  }

  protected override async rollbackTransaction(connection: Connection, e: unknown) {
    if (e instanceof NotRollBackError) {
      throw e.originError;
    }

    await connection.rollbackTransaction();
    await emitAsyncOnRollBackEvent(e);
    throw e;
  }

  protected override async finishTransaction(
    connection: Connection,
    dataSourceName: DataSourceName,
  ) {
    await connection.release();
    storage.set(dataSourceName, undefined);
  }
}

@Injectable()
export class WrapTransactionDemacrcation extends NewTransactionDemacrcation {
  protected override async commitTransaction(connection: Connection): Promise<void> {
    await connection.commitTransaction();
  }

  protected override async rollbackTransaction(connection: Connection, e: unknown) {
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
