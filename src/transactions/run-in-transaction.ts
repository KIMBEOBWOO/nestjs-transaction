import { wrapInTransaction } from '.';
import { TransactionOptions } from '../interfaces';
import {
  TransactionDemacrcationFactory,
  NewTransactionDemacrcation,
  RunOriginalAndEventTransactionDemacrcation,
  RunOriginalTransactionDemacrcation,
  WrapTransactionDemacrcation,
  ConnectionManager,
} from '../providers';

const connectionManager = new ConnectionManager();
const demacrcationFactory = new TransactionDemacrcationFactory(
  new NewTransactionDemacrcation(connectionManager),
  new RunOriginalAndEventTransactionDemacrcation(connectionManager),
  new RunOriginalTransactionDemacrcation(connectionManager),
  new WrapTransactionDemacrcation(connectionManager),
);

export const runInTransaction = <Func extends (this: unknown) => ReturnType<Func>>(
  fn: Func,
  options?: TransactionOptions,
) => {
  return wrapInTransaction(fn, options, demacrcationFactory)();
};
