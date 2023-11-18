import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from '../../../src';
import { LOG_DB_NAME } from './const';
import { mainDataSourceOpiton, subDataSourceOption } from './data-sources';

@Module({
  imports: [
    // Postgres Database
    TypeOrmModule.forRootAsync({
      useFactory: () => mainDataSourceOpiton,
      // dataSource receives the configured DataSourceOptions
      // and returns a Promise<DataSource>.
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('Invalild DataSource options');
        }

        return addTransactionalDataSource(new DataSource(options));
      },
    }),
    // Postgres Database 2
    TypeOrmModule.forRootAsync({
      name: LOG_DB_NAME,
      useFactory: () => subDataSourceOption,
      // dataSource receives the configured DataSourceOptions
      // and returns a Promise<DataSource>.
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('Invalild DataSource options');
        }

        return addTransactionalDataSource(new DataSource(options));
      },
    }),
  ],
  providers: [],
})
export class DatabaseModule {}
