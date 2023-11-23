import {
  DynamicModule,
  Inject,
  Module,
  OnModuleInit,
  Optional,
  ValueProvider,
} from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { DataSource } from 'typeorm';
import {
  addTransactionalDataSource,
  getDataSource,
  initializeTransactionalContext,
  TRANSACTION_MODULE_OPTION_TOKEN,
} from '../common';
import { NoRegistedDataSourceError } from '../errors';
import { TransactionModuleOption } from '../interfaces';

@Module({
  imports: [DiscoveryModule],
})
export class TransactionModule implements OnModuleInit {
  constructor(
    private readonly discoveryService: DiscoveryService,
    @Optional()
    @Inject(TRANSACTION_MODULE_OPTION_TOKEN)
    private readonly transactionModuleOption?: TransactionModuleOption,
  ) {
    initializeTransactionalContext();
  }

  onModuleInit() {
    this.discoveryService
      .getProviders()
      .filter(this.isDataSourceInstanceWrapper)
      .forEach((instanceWrapper) => {
        try {
          getDataSource(instanceWrapper.instance.name);
        } catch (e) {
          if (e instanceof NoRegistedDataSourceError) {
            return addTransactionalDataSource(instanceWrapper.instance);
          } else {
            throw e;
          }
        }
      });
  }

  static forRoot(option?: TransactionModuleOption): DynamicModule {
    const transactionModuleOptionProviders = this.getTransacionModuleOptionProviders(option);

    return {
      module: TransactionModule,
      providers: [...transactionModuleOptionProviders],
      exports: [...transactionModuleOptionProviders.map((provider) => provider.provide)],
    };
  }

  /**
   * Register the option provider used by the transaction module
   * @param option optional, Transaction Module option
   * @returns ValueProvider[]
   */
  private static getTransacionModuleOptionProviders(
    option?: TransactionModuleOption,
  ): ValueProvider[] {
    return [
      {
        provide: TRANSACTION_MODULE_OPTION_TOKEN,
        useValue: option || {},
      },
    ];
  }

  private isDataSourceInstanceWrapper = (
    value: InstanceWrapper<any>,
  ): value is InstanceWrapper<DataSource> => {
    const isDataSourceInstance = (value: unknown): value is DataSource =>
      value instanceof DataSource;

    if (isDataSourceInstance(value.instance)) {
      if (
        this?.transactionModuleOption?.dataSourceNames !== undefined &&
        this.transactionModuleOption.dataSourceNames.find(
          (name) => name === value.instance.name,
        ) === undefined
      ) {
        return false;
      }

      return true;
    }

    return false;
  };
}
