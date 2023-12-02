import { Injectable } from '@nestjs/common';
import { TransactionEventListener } from '../../../src';
import { UserService } from './user.service';

@Injectable()
export class CustomTransactionProvider implements TransactionEventListener {
  constructor(private readonly userService: UserService) {}

  async onCommit(): Promise<void> {
    await this.userService.userRepository.find();
  }

  async onRollBack(): Promise<void> {
    await this.userService.userRepository.find();
  }
}
