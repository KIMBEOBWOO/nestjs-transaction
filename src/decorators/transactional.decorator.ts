import { TransactionOptions } from '../interfaces';
import { createDecorator } from '@toss/nestjs-aop';
import { TRANSACTION_DECORATOR } from '../common';

/**
 * Transaction Decorator (for Method)
 * @param options Set options for transaction propagation and isolation levels
 * @returns MethodDecorator
 */
export const Transactional = (options?: TransactionOptions) =>
  createDecorator(TRANSACTION_DECORATOR, options);
