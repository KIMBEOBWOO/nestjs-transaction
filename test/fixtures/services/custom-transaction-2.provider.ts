import { Injectable } from '@nestjs/common';
import { TransactionEventListener } from '../../../src';
import { UserService } from './user.service';

@Injectable()
export class CustomTransactionProvider2 implements TransactionEventListener {
  constructor(private readonly userService: UserService) {}

  async onCommit(...param: unknown[]): Promise<void> {
    await this.userService.userRepository.find();
    console.log('CustomTransactionProvider2', 'onCommit');
  }

  async onRollBack(...param: unknown[]): Promise<void> {
    await this.userService.userRepository.find();
    console.log('CustomTransactionProvider2', 'onRollBack');
  }
}
