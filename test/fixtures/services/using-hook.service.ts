import { Injectable } from '@nestjs/common';
import { Propagation, Transactional, TransactionalEventListeners } from '../../../src';
import { CustomTransactionProvider } from './custom-transaction.provider';
import { UserService } from './user.service';

@Injectable()
export class UsingHookService {
  constructor(private readonly userService: UserService) {}

  @Transactional()
  @TransactionalEventListeners(CustomTransactionProvider)
  async createUserRequired(id: string, cb?: () => Promise<unknown>) {
    await this.userService.createUser(id);

    await cb?.();
  }

  @Transactional({
    propagation: Propagation.SUPPORTS,
  })
  @TransactionalEventListeners('CustomTransactionProvider2')
  async createUserSupports(id: string, cb?: () => Promise<unknown>) {
    // await this.userService.createUser(id);

    await cb?.();

    return 'test';
  }
}
