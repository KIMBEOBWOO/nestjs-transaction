import { Inject } from '@nestjs/common';
import { Aspect, LazyDecorator, WrapParams } from '@toss/nestjs-aop';
import { ExecutableTransaction, TransactionOptions } from '../interfaces';
import { TRANSACTION_DECORATOR, TYPEORM_TRANSACTION_SERVICE_TOKEN } from '../symbols';
import { wrapInTransaction } from '../transactions';

@Aspect(TRANSACTION_DECORATOR)
export class ALSTransactionAspect implements LazyDecorator<any, TransactionOptions> {
  constructor(
    @Inject(TYPEORM_TRANSACTION_SERVICE_TOKEN)
    private readonly transactionService: ExecutableTransaction,
  ) {}

  wrap({ method, metadata }: WrapParams<any, TransactionOptions>) {
    return async (...args: any) => {
      return wrapInTransaction(() => method(...args), this.transactionService, metadata)();
    };
  }
}
