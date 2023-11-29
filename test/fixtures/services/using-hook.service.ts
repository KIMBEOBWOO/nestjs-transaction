import { Injectable } from '@nestjs/common';
import { Propagation, Transactional } from '../../../src';
import { UserService } from './user.service';

@Injectable()
export class UsingHookService {
  constructor(private readonly userService: UserService) {}

  @Transactional({
    customTransactionToken: 'CustomTransactionProvider',
  })
  async createUserRequired(id: string, cb?: () => Promise<unknown>) {
    await this.userService.createUser(id);

    await cb?.();
  }

  @Transactional({
    propagation: Propagation.SUPPORTS,
    customTransactionToken: 'CustomTransactionProvider2',
  })
  async createUserSupports(id: string, cb?: () => Promise<unknown>) {
    await this.userService.createUser(id);

    await cb?.();
  }
}
