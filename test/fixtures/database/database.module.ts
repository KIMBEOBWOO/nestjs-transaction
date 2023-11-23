import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { mainDataSourceOpiton, subDataSourceOption } from './data-sources';

@Module({
  imports: [
    // Postgres Database
    TypeOrmModule.forRootAsync({
      useFactory: () => mainDataSourceOpiton,
    }),
    // Postgres Database 2
    TypeOrmModule.forRoot(subDataSourceOption),
  ],
  providers: [],
})
export class DatabaseModule {}
