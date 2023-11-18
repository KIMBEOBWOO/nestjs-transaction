import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule, LOG_DB_NAME, Log, User } from './database';
import { UsingCallbackService, UserService, WithoutTransactionalService } from './services';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([User]),
    TypeOrmModule.forFeature([Log], LOG_DB_NAME),
  ],
  providers: [UserService, UsingCallbackService, WithoutTransactionalService],
})
export class AppModule {}
