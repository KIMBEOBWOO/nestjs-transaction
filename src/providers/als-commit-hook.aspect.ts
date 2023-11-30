import { Aspect } from '@toss/nestjs-aop';
import { Transaction } from '../interfaces';
import { addOnCommitListenerToStore, TRANSACTION_ON_COMMIT_DECORATOR } from '../common';
import { ModuleRef } from '@nestjs/core';
import { ALSHook } from './als-hook';

@Aspect(TRANSACTION_ON_COMMIT_DECORATOR)
export class ALSCommitHookAspect extends ALSHook {
  constructor(protected moduleRef: ModuleRef) {
    super(moduleRef);
  }

  protected addListenerToStore(
    dataSourceName: string,
    transaction: Transaction,
    args: unknown[],
  ): void {
    addOnCommitListenerToStore(dataSourceName, transaction, args);
  }
}
