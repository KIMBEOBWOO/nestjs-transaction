import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionModule } from '../../src';
import { UserController } from './controllers';
import { DatabaseModule, LOG_DB_NAME, Log, User, Counter, SubCounter } from './database';
import {
  UsingCallbackService,
  UserService,
  WithoutTransactionalService,
  CustomTransactionProvider,
} from './services';

@Module({
  imports: [
    TransactionModule.forRoot(),
    DatabaseModule,
    TypeOrmModule.forFeature([User, Counter]),
    TypeOrmModule.forFeature([Log, SubCounter], LOG_DB_NAME),
  ],
  controllers: [UserController],
  providers: [
    UserService,
    UsingCallbackService,
    WithoutTransactionalService,
    {
      provide: 'CustomTransactionProvider',
      useClass: CustomTransactionProvider,
    },
  ],
})
export class AppModule {}
