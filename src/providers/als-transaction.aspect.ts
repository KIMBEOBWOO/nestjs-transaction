import { Inject } from '@nestjs/common';
import { Aspect, LazyDecorator, WrapParams } from '@toss/nestjs-aop';
import { Transaction, TransactionOptions } from '../interfaces';
import { getTransactionProviderToken, TRANSACTION_DECORATOR } from '../common';
import { wrapInTransaction } from '../transactions';
import { ModuleRef } from '@nestjs/core';

@Aspect(TRANSACTION_DECORATOR)
export class ALSTransactionAspect implements LazyDecorator<any, TransactionOptions> {
  constructor(
    @Inject(getTransactionProviderToken())
    private readonly transaction: Transaction,
    private moduleRef: ModuleRef,
  ) {}

  wrap({ method, metadata }: WrapParams<any, TransactionOptions>) {
    return async (...args: any) => {
      const transaction = this.getTransaction(metadata);
      return wrapInTransaction(() => method(...args), transaction, metadata)();
    };
  }

  /**
   * get Transaction provider
   * @param metadata TransactionOptions
   */
  private getTransaction(metadata?: TransactionOptions) {
    if (metadata?.customTransactionToken !== undefined) {
      // NOTE : if customTransactionToken is exist, get custom transaction provider
      const customTransaction = this.moduleRef.get<Transaction>(metadata.customTransactionToken, {
        strict: false,
      });

      return customTransaction;
    }

    return this.transaction;
  }
}
