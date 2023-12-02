import { Injectable } from '@nestjs/common';
import { TransactionEventListener } from '../../../src';
import { UserService } from './user.service';

@Injectable()
export class CustomTransactionProvider implements TransactionEventListener {
  constructor(private readonly userService: UserService) {}

  async onCommit(...param: unknown[]): Promise<void> {
    // await this.userService.userRepository.find();
    console.log('CustomTransactionProvider', 'onCommit');
  }

  async onRollBack(...param: unknown[]): Promise<void> {
    // await this.userService.userRepository.find();
    console.log('CustomTransactionProvider', 'onRollBack');
  }
}
