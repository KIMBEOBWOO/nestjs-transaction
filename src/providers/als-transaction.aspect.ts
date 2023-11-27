import { Inject } from '@nestjs/common';
import { Aspect, LazyDecorator, WrapParams } from '@toss/nestjs-aop';
import { Transaction, TransactionOptions } from '../interfaces';
import { getTransactionProviderToken, TRANSACTION_DECORATOR } from '../common';
import { wrapInTransaction } from '../transactions';

@Aspect(TRANSACTION_DECORATOR)
export class ALSTransactionAspect implements LazyDecorator<any, TransactionOptions> {
  constructor(
    @Inject(getTransactionProviderToken())
    private readonly transaction: Transaction,
  ) {}

  wrap({ method, metadata }: WrapParams<any, TransactionOptions>) {
    return async (...args: any) => {
      return wrapInTransaction(() => method(...args), this.transaction, metadata)();
    };
  }
}
