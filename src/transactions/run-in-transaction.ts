import { wrapInTransaction } from '.';
import { TransactionOptions } from '../interfaces';
import { TypeOrmTransactionProvider } from '../providers';

export const runInTransaction = <Func extends (this: unknown) => ReturnType<Func>>(
  fn: Func,
  options?: TransactionOptions,
) => {
  return wrapInTransaction(fn, new TypeOrmTransactionProvider(), options)();
};
