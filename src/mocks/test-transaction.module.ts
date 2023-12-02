import { Module } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { AopModule } from '@toss/nestjs-aop';
import { TransactionModule } from '../module';

/**
 * @deprecated
 */
@Module({
  imports: [AopModule, DiscoveryModule],
})
export class TestTransactionModule extends TransactionModule {
  constructor(protected discoveryService: DiscoveryService) {
    super(discoveryService);
  }
}
