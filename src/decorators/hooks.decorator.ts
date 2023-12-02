import { Type } from '@nestjs/common';
import { createDecorator } from '@toss/nestjs-aop';
import { TRANSACTION_EVENT_LISTENER_DECORATOR } from '../common';
import { TransactionOptions } from '../interfaces';

type TransactionHookToken = symbol | string | Type<any>;
export interface TransactionHookOption extends Pick<TransactionOptions, 'connectionName'> {
  /**
   * Set execute target for onCommit hooks, target is injectable class or injected providers provide token
   */
  transactionHook: TransactionHookToken;
}

export const TransactionalEventListeners = (symbol: TransactionHookToken) =>
  createDecorator(TRANSACTION_EVENT_LISTENER_DECORATOR, {
    transactionHook: symbol,
  } as TransactionHookOption);
