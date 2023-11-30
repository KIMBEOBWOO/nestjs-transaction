import { Aspect } from '@toss/nestjs-aop';
import { Transaction } from '../interfaces';
import { addOnRollBackListenerToStore, TRANSACTION_ROLL_BACK_DECORATOR } from '../common';
import { ModuleRef } from '@nestjs/core';
import { ALSHook } from './als-hook';

@Aspect(TRANSACTION_ROLL_BACK_DECORATOR)
export class ALSRollBackHookAspect extends ALSHook {
  constructor(protected moduleRef: ModuleRef) {
    super(moduleRef);
  }

  protected addListenerToStore(
    dataSourceName: string,
    transaction: Transaction,
    args: unknown[],
  ): void {
    addOnRollBackListenerToStore(dataSourceName, transaction, args);
  }
}
