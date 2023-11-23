import { DynamicModule, Module } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { AopModule } from '@toss/nestjs-aop';
import { TransactionModuleOption } from '../interfaces';
import { TransactionModule } from '../module';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TEST_QUERY_RUNNER_TOKEN } from '../symbols';

@Module({
  imports: [AopModule, DiscoveryModule],
})
export class MockTransactionModule extends TransactionModule {
  constructor(protected discoveryService: DiscoveryService) {
    super(discoveryService);
  }

  static override forRoot(option?: TransactionModuleOption): DynamicModule {
    const moduleOptionProviders = this.getTransacionModuleOptionProviders(option);
    const serviceProviders = this.getServiceProividers();
    const testResourceProviders = this.getTestResourceProviders();

    return {
      module: TransactionModule,
      providers: [...moduleOptionProviders, ...serviceProviders, ...testResourceProviders],
      exports: [
        ...moduleOptionProviders.map((provider) => provider.provide),
        ...serviceProviders.map((provider) =>
          'provide' in provider ? provider.provide : provider,
        ),
        ...testResourceProviders.map((provider) => provider.provide),
      ],
    };
  }

  private static getTestResourceProviders() {
    return [
      {
        provide: TEST_QUERY_RUNNER_TOKEN,
        useFactory: (dataSource: DataSource) => {
          return dataSource.createQueryRunner();
        },
        inject: [getDataSourceToken()],
      },
    ];
  }
}
