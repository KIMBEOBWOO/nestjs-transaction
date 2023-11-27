import { Inject, Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { getTestQueryRunnerToken } from '../common';
import { TypeORMTransactionService } from '../providers/typeorm-transaction.service';

@Injectable()
export class TestTypeORMTransactionService extends TypeORMTransactionService {
  constructor(
    @Inject(getTestQueryRunnerToken())
    private readonly testQueryRunner: QueryRunner,
  ) {
    super();
  }
}
