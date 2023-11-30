import { LazyDecorator, WrapParams } from '@toss/nestjs-aop';
import { Transaction } from '../interfaces';
import { addOnCommitListenerToStore, TYPEORM_DEFAULT_DATA_SOURCE_NAME } from '../common';
import { ModuleRef } from '@nestjs/core';
import { TransactionHookOption } from '../decorators';

export abstract class ALSHook implements LazyDecorator<any> {
  constructor(protected moduleRef: ModuleRef) {}

  wrap({ method, metadata }: WrapParams<any, TransactionHookOption>) {
    const isActive = metadata !== undefined;

    return async (...args: any) => {
      if (isActive) {
        const dataSourceName = metadata.connectionName || TYPEORM_DEFAULT_DATA_SOURCE_NAME;
        const transactionHookToken = metadata.transactionHook;
        const transaction = this.getTransaction(transactionHookToken);

        this.addListenerToStore(dataSourceName, transaction, args);

        return await method(...args);
      }

      return method(...args);
    };
  }

  /**
   * add listener to store
   * - must be called after storage.run()
   */
  protected abstract addListenerToStore(
    ...args: Parameters<typeof addOnCommitListenerToStore>
  ): void;

  private getTransaction(token: TransactionHookOption['transactionHook']) {
    // NOTE : if customTransactionToken is exist, get custom transaction provider
    // moduleRef.get() is throw error if customTransactionToken is not exist
    const customTransaction = this.moduleRef.get<Transaction>(token, {
      strict: false,
    });

    return customTransaction;
  }
}
