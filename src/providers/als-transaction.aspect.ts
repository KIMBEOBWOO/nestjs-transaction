import { Inject } from '@nestjs/common';
import { Aspect, LazyDecorator, WrapParams } from '@toss/nestjs-aop';
import { ExecutableTransaction, TransactionOptions } from '../interfaces';
import { getTransactionServiceToken, TRANSACTION_DECORATOR } from '../common';
import { wrapInTransaction } from '../transactions';

@Aspect(TRANSACTION_DECORATOR)
export class ALSTransactionAspect implements LazyDecorator<any, TransactionOptions> {
  constructor(
    @Inject(getTransactionServiceToken())
    private readonly transactionService: ExecutableTransaction,
  ) {}

  wrap({ method, metadata }: WrapParams<any, TransactionOptions>) {
    return async (...args: any) => {
      return wrapInTransaction(() => method(...args), this.transactionService, metadata)();
    };
  }
}
