import {
  ClassProvider,
  DynamicModule,
  FactoryProvider,
  Inject,
  Module,
  OnModuleInit,
  Optional,
  Type,
  ValueProvider,
} from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { AopModule } from '@toss/nestjs-aop';
import { DataSource } from 'typeorm';
import {
  addTransactionalDataSource,
  getDataSource,
  initializeTransactionalContext,
  TRANSACTION_MODULE_OPTION_TOKEN,
  getTransactionServiceToken,
} from '../common';
import { NoRegistedDataSourceError } from '../errors';
import { TransactionModuleOption } from '../interfaces';
import { ALSTransactionAspect } from '../providers';
import { TypeORMTransactionService } from '../providers/typeorm-transaction.service';

@Module({
  imports: [AopModule, DiscoveryModule],
})
export class TransactionModule implements OnModuleInit {
  constructor(
    protected readonly discoveryService: DiscoveryService,
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
    const moduleOptionProviders = this.getTransacionModuleOptionProviders(option);
    const serviceProviders = this.getServiceProividers();

    return {
      module: TransactionModule,
      providers: [...moduleOptionProviders, ...serviceProviders],
      exports: [
        ...moduleOptionProviders.map((provider) => provider.provide),
        ...serviceProviders.map((provider) =>
          'provide' in provider ? provider.provide : provider,
        ),
      ],
    };
  }

  /**
   * Register the Aspect provider used by the transaction module
   * @param option optional, Transaction Module option
   * @returns ValueProvider[]
   */
  protected static getServiceProividers(): (Type | FactoryProvider | ClassProvider)[] {
    return [
      ALSTransactionAspect,
      {
        provide: getTransactionServiceToken(),
        useClass: TypeORMTransactionService,
      },
    ];
  }

  /**
   * Register the option provider used by the transaction module
   * @param option optional, Transaction Module option
   * @returns ValueProvider[]
   */
  protected static getTransacionModuleOptionProviders(
    option?: TransactionModuleOption,
  ): ValueProvider[] {
    return [
      {
        provide: TRANSACTION_MODULE_OPTION_TOKEN,
        useValue: option || {},
      },
    ];
  }

  protected isDataSourceInstanceWrapper = (
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
