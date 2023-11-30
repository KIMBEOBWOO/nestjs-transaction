import { Injectable } from '@nestjs/common';
import { Transaction } from '../../../src/interfaces';
import { UserService } from './user.service';

@Injectable()
export class CustomTransactionProvider implements Transaction {
  constructor(private readonly userService: UserService) {}

  async onCommit(...param: unknown[]): Promise<void> {
    await this.userService.userRepository.find();
  }

  async onRollBack(...param: unknown[]): Promise<void> {
    await this.userService.userRepository.find();
  }
}
