import { wrapInTransaction } from '.';
import { TransactionOptions } from '../interfaces';

export const runInTransaction = <Func extends (this: unknown) => ReturnType<Func>>(
  fn: Func,
  options?: TransactionOptions,
) => {
  return wrapInTransaction(fn, options)();
};
