import { wrapInTransaction } from '.';
import { TransactionOptions } from '../interfaces';
import { TypeORMTransactionService } from '../providers/typeorm-transaction.service';

export const runInTransaction = <Func extends (this: unknown) => ReturnType<Func>>(
  fn: Func,
  options?: TransactionOptions,
) => {
  return wrapInTransaction(fn, TypeORMTransactionService.getInstance(), options)();
};
