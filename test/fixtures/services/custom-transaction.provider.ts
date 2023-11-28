import { Injectable } from '@nestjs/common';
import { TypeOrmTransactionProvider } from '../../../src';
import { UserService } from './user.service';

@Injectable()
export class CustomTransactionProvider extends TypeOrmTransactionProvider {
  constructor(private readonly userService: UserService) {
    super();
  }

  override async onCommit(...param: unknown[]): Promise<void> {
    await this.userService.createUser();

    await super.onCommit(...param);
    console.log('CustomTransactionProvider onCommit');
  }

  override async onRollBack(...param: unknown[]): Promise<void> {
    await super.onRollBack(...param);
    console.log('CustomTransactionProvider onRollBack');
  }
}
