import { wrapInTransaction } from '.';
import { Transaction, TransactionOptions } from '../interfaces';

export const runInTransaction = <Func extends (this: unknown) => ReturnType<Func>>(
  fn: Func,
  options?: TransactionOptions,
  transaction?: Transaction,
) => {
  return wrapInTransaction(fn, transaction, options)();
};
