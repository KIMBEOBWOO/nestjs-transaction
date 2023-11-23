import { TYPEORM_DEFAULT_DATA_SOURCE_NAME } from '../common';
import { PropagationType, Propagation } from '../enums';
import { TransactionOptions, ExecutableTransaction } from '../interfaces';
import { storage } from '../storage';

export const wrapInTransaction = <Fn extends (this: any, ...args: any[]) => ReturnType<Fn>>(
  fn: Fn,
  executableTransaction: ExecutableTransaction,
  options?: TransactionOptions,
) => {
  function wrapper(this: unknown, ...args: unknown[]) {
    const propagation: PropagationType = options?.propagation || Propagation.REQUIRED;
    const runOriginal = () => fn.apply(this, args);

    const dataSourceName = options?.connectionName || TYPEORM_DEFAULT_DATA_SOURCE_NAME;
    const store = storage.getContext(dataSourceName);

    switch (propagation) {
      case Propagation.REQUIRED:
        if (executableTransaction.isActive(store)) {
          return executableTransaction.joinInCurrentTransaction(runOriginal, options);
        } else {
          return executableTransaction.runInNewTransaction(runOriginal, options);
        }
      case Propagation.SUPPORTS:
        if (executableTransaction.isActive(store)) {
          return executableTransaction.joinInCurrentTransaction(runOriginal, options);
        } else {
          return runOriginal();
        }
    }
  }

  return wrapper as Fn;
};
