import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { DataSourceName } from '../common';
import { TransactionalError } from '../errors';
import { storage } from '../storage';

export type Connection = QueryRunner;

@Injectable()
export class ConnectionManager {
  getConnection(dataSourceName: DataSourceName): Connection {
    const queryRunner = storage.get<QueryRunner>(dataSourceName);

    if (!queryRunner) {
      throw new TransactionalError(
        'AsyncLocalStorage throw system error, please re-run your application',
      );
    }

    return queryRunner;
  }
}
