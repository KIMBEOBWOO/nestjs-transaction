import { PropagationType, Propagation } from '../enums';
import { TransactionOptions, ExecutableTransaction } from '../interfaces';

export const wrapInTransaction = <Fn extends (this: any, ...args: any[]) => ReturnType<Fn>>(
  fn: Fn,
  executableTransaction: ExecutableTransaction,
  options?: TransactionOptions,
) => {
  function wrapper(this: unknown, ...args: unknown[]) {
    const propagation: PropagationType = options?.propagation || Propagation.REQUIRED;
    const runOriginal = () => fn.apply(this, args);

    switch (propagation) {
      case Propagation.REQUIRED:
        if (executableTransaction.isActive(options)) {
          return executableTransaction.joinInCurrentTransaction(runOriginal, options);
        } else {
          return executableTransaction.runInNewTransaction(runOriginal, options);
        }
      case Propagation.SUPPORTS:
        if (executableTransaction.isActive(options)) {
          return executableTransaction.joinInCurrentTransaction(runOriginal, options);
        } else {
          return runOriginal();
        }
    }
  }

  return wrapper as Fn;
};
