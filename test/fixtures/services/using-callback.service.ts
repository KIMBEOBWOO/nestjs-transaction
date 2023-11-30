import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Propagation, Transactional } from '../../../src';
import { User } from '../database';
import { UserService } from './user.service';
import { WithoutTransactionalService } from './without-transactional.service';

@Injectable()
export class UsingCallbackService {
  constructor(
    private readonly userService: UserService,
    @InjectDataSource() private readonly dataSoruce: DataSource,
    private readonly withoutTransactionService: WithoutTransactionalService,
  ) {}

  @Transactional({
    propagation: Propagation.REQUIRED,
  })
  async createAndUpdateUserRequied(id: string, id2: string, cb?: () => Promise<unknown>) {
    await this.userService.createUser(id);
    await this.userService.updateUser(id, {
      email: 'updated@google.com',
    });
    const updateResult = await this.dataSoruce.manager.update(User, id, {
      updated_at: null,
    });

    if (!updateResult?.affected) {
      throw new NotFoundException();
    }

    await this.userService.createUser();
    await this.userService.createUser();

    await this.withoutTransactionService.createUser(id2);

    await cb?.();
  }

  @Transactional({
    propagation: Propagation.SUPPORTS,
  })
  async createAndUpdateUserSupports(id: string, cb?: () => Promise<unknown>) {
    await this.userService.createUser(id);
    await this.userService.updateUser(id, {
      email: 'updated@google.com',
    });

    const updateResult = await this.dataSoruce.manager.update(User, id, {
      updated_at: null,
    });

    if (!updateResult?.affected) {
      throw new NotFoundException();
    }

    await cb?.();

    return id;
  }
}
