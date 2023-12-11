import { Injectable } from '@nestjs/common';
import { Propagation, Transactional, TransactionalEventListeners } from '../../../src';
import { CustomTransactionProvider } from './custom-transaction.provider';

@Injectable()
export class UsingHookService {
  @Transactional()
  @TransactionalEventListeners(CustomTransactionProvider)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createUserRequired(cb?: () => Promise<unknown>, ...param: unknown[]) {
    await cb?.();
  }

  @Transactional({
    propagation: Propagation.SUPPORTS,
  })
  @TransactionalEventListeners(CustomTransactionProvider)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createUserSupports(cb?: () => Promise<unknown>, ...param: unknown[]) {
    await cb?.();
  }

  @Transactional({
    propagation: Propagation.NESTED,
  })
  @TransactionalEventListeners(CustomTransactionProvider)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createUserNested(cb?: () => Promise<unknown>, ...param: unknown[]) {
    await cb?.();
  }

  @Transactional({
    propagation: Propagation.REQUIRES_NEW,
  })
  @TransactionalEventListeners(CustomTransactionProvider)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createUserRequiresNew(cb?: () => Promise<unknown>, ...param: unknown[]) {
    await cb?.();
  }
}
