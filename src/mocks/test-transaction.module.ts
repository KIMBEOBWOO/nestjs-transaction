import { ClassProvider, FactoryProvider, Module, Type } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { AopModule } from '@toss/nestjs-aop';
import { TransactionModule } from '../module';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { ALSTransactionAspect } from '../providers';
import { TestTypeORMTransactionService } from './test-typeorm-transaction.service';
import { getTestQueryRunnerToken, getTransactionServiceToken } from '../common';

@Module({
  imports: [AopModule, DiscoveryModule],
})
export class TestTransactionModule extends TransactionModule {
  constructor(protected discoveryService: DiscoveryService) {
    super(discoveryService);
  }

  protected static getServiceProividers(): (Type | FactoryProvider | ClassProvider)[] {
    return [
      ALSTransactionAspect,
      {
        provide: getTestQueryRunnerToken(),
        useFactory: (dataSource: DataSource) => {
          return dataSource.createQueryRunner();
        },
        inject: [getDataSourceToken()],
      },
      {
        provide: getTransactionServiceToken(),
        useFactory: (testQueryRunner: QueryRunner) => {
          return new TestTypeORMTransactionService(testQueryRunner);
        },
        inject: [getTestQueryRunnerToken()],
      },
    ];
  }
}
