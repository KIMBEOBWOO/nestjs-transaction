import { Type } from '@nestjs/common';
import { createDecorator } from '@toss/nestjs-aop';
import { TRANSACTION_ON_COMMIT_DECORATOR, TRANSACTION_ROLL_BACK_DECORATOR } from '../common';
import { TransactionOptions } from '../interfaces';

type TransactionHookToken = symbol | string | Type<any>;
export interface TransactionHookOption extends Pick<TransactionOptions, 'connectionName'> {
  /**
   * Set execute target for onCommit hooks, target is injectable class or injected providers provide token
   */
  transactionHook: TransactionHookToken;
}

/**
 * OnCommit Hooks Decorator (for Method)
 * @param transactionHookToken Set execute target for onCommit hooks, target is injectable class or injected providers provide token
 * @returns MethodDecorator
 */
export const OnCommit = (option: TransactionHookOption) =>
  createDecorator(TRANSACTION_ON_COMMIT_DECORATOR, option);

/**
 * OnRollback Hooks Decorator (for Method)
 * @param transactionHookToken Set execute target for onRollback hooks, target is injectable class or injected providers provide token
 * @returns MethodDecorator
 */
export const OnRollBack = (option: TransactionHookOption) =>
  createDecorator(TRANSACTION_ROLL_BACK_DECORATOR, option);
