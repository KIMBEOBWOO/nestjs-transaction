import { Injectable } from '@nestjs/common';
import { OnCommit, OnRollBack, Propagation, Transactional } from '../../../src';
import { CustomTransactionProvider } from './custom-transaction.provider';
import { UserService } from './user.service';

@Injectable()
export class UsingHookService {
  constructor(private readonly userService: UserService) {}

  @Transactional()
  @OnCommit({ transactionHook: CustomTransactionProvider })
  @OnRollBack({ transactionHook: CustomTransactionProvider })
  async createUserRequired(id: string, cb?: () => Promise<unknown>) {
    await this.userService.createUser(id);

    await cb?.();
  }

  @Transactional({
    propagation: Propagation.SUPPORTS,
  })
  @OnCommit({ transactionHook: 'CustomTransactionProvider2' })
  async createUserSupports(id: string, cb?: () => Promise<unknown>) {
    await this.userService.createUser(id);

    await cb?.();
  }
}
