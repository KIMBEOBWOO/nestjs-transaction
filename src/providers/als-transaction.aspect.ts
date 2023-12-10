import { Aspect, LazyDecorator, WrapParams } from '@toss/nestjs-aop';
import { TransactionOptions } from '../interfaces';
import { TRANSACTION_DECORATOR, TRANSACTION_DEMARCATION_FACTORY_TOKEN } from '../common';
import { wrapInTransaction } from '../transactions';
import { Inject } from '@nestjs/common';
import { TransactionDemacrcationFactory } from './transaction-demacrcation.factory';

@Aspect(TRANSACTION_DECORATOR)
export class ALSTransactionAspect implements LazyDecorator<any, TransactionOptions> {
  constructor(
    @Inject(TRANSACTION_DEMARCATION_FACTORY_TOKEN)
    private readonly demacrcationFactory: TransactionDemacrcationFactory,
  ) {}

  wrap({ method, metadata }: WrapParams<any, TransactionOptions>) {
    return async (...args: any) => {
      return wrapInTransaction(() => method(...args), metadata, this.demacrcationFactory)();
    };
  }
}
