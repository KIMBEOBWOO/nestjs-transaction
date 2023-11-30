import { Aspect, LazyDecorator, WrapParams } from '@toss/nestjs-aop';
import { TransactionOptions } from '../interfaces';
import { TRANSACTION_DECORATOR } from '../common';
import { wrapInTransaction } from '../transactions';

@Aspect(TRANSACTION_DECORATOR)
export class ALSTransactionAspect implements LazyDecorator<any, TransactionOptions> {
  wrap({ method, metadata }: WrapParams<any, TransactionOptions>) {
    return async (...args: any) => {
      return wrapInTransaction(() => method(...args), metadata)();
    };
  }
}
