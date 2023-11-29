import { Injectable } from '@nestjs/common';
import { TypeOrmTransactionProvider } from '../../../src';
import { UserService } from './user.service';

@Injectable()
export class CustomTransactionProvider2 extends TypeOrmTransactionProvider {
  constructor(private readonly userService: UserService) {
    super();
  }

  override async onCommit(...param: unknown[]): Promise<void> {
    await this.userService.userRepository.find();
  }

  override async onRollBack(...param: unknown[]): Promise<void> {
    await this.userService.userRepository.find();
  }
}
