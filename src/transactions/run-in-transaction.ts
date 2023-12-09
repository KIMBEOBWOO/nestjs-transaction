import { wrapInTransaction } from '.';
import { TransactionOptions } from '../interfaces';
import {
  TransactionDemacrcationFactory,
  NewTransactionDemacrcation,
  RunOriginalAndEventTransactionDemacrcation,
  RunOriginalTransactionDemacrcation,
  WrapTransactionDemacrcation,
} from '../providers';

const demacrcationFactory = new TransactionDemacrcationFactory(
  new NewTransactionDemacrcation(),
  new RunOriginalAndEventTransactionDemacrcation(),
  new RunOriginalTransactionDemacrcation(),
  new WrapTransactionDemacrcation(),
);

export const runInTransaction = <Func extends (this: unknown) => ReturnType<Func>>(
  fn: Func,
  options?: TransactionOptions,
) => {
  return wrapInTransaction(fn, options, demacrcationFactory)();
};
