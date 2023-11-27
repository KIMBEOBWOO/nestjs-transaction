import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { Transaction } from '../interfaces';

@Injectable()
export class TypeOrmTransactionProvider implements Transaction {
  async onCommit(...param: unknown[]): Promise<void> {
    const queryRunner = param[0] as QueryRunner;
    await queryRunner.commitTransaction();
  }

  async onRollBack(...param: unknown[]): Promise<void> {
    const queryRunner = param[0] as QueryRunner;
    await queryRunner.rollbackTransaction();
  }
}
