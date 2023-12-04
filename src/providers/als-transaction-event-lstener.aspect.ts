import { Aspect, LazyDecorator, WrapParams } from '@toss/nestjs-aop';
import { TransactionEventListener } from '../interfaces';
import { TRANSACTION_EVENT_LISTENER_DECORATOR, TYPEORM_DEFAULT_DATA_SOURCE_NAME } from '../common';
import { ModuleRef } from '@nestjs/core';
import { TransactionHookOption } from '../decorators';
import { runOnTransactionCommit, runOnTransactionRollback } from '../transactions';

@Aspect(TRANSACTION_EVENT_LISTENER_DECORATOR)
export class ALSTransactionEventListenerAspect implements LazyDecorator<any> {
  constructor(protected moduleRef: ModuleRef) {}

  wrap({ method, metadata }: WrapParams<any, TransactionHookOption>) {
    const isActive = metadata !== undefined;

    return (...args: any) => {
      if (isActive) {
        metadata.connectionName || TYPEORM_DEFAULT_DATA_SOURCE_NAME;
        const transactionHookToken = metadata.transactionHook;
        const transaction = this.getTransaction(transactionHookToken);

        this.addListenerToStore(transaction, args);

        return method(...args);
      }

      return method(...args);
    };
  }

  /**
   * add listener to store
   * - must be called after storage.run()
   */
  protected addListenerToStore(listener: TransactionEventListener, args: unknown[]) {
    runOnTransactionCommit(async () => listener.onCommit(...args));
    runOnTransactionRollback(async (e: Error) => listener.onRollBack(e, ...args));
  }

  private getTransaction(token: TransactionHookOption['transactionHook']) {
    // NOTE : if customTransactionToken is exist, get custom transaction provider
    // moduleRef.get() is throw error if customTransactionToken is not exist
    const customTransaction = this.moduleRef.get<TransactionEventListener>(token, {
      strict: false,
    });

    return customTransaction;
  }
}
