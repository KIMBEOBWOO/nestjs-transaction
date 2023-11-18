import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';
import { LOG_DB_NAME } from '../const';

export const dataSourceOption: DataSourceOptions & SeederOptions = {
  // NOTE : if use name, must be defined
  name: LOG_DB_NAME,
  type: 'postgres',
  host: '127.0.0.1',
  port: 5436,
  username: 'beobwoo',
  password: 'testtest',
  database: 'test_db_2',
  // Entity file path (always consider dockerfile)
  entities: [__dirname + '/../entities/postgres-sub/**/*.entity{.ts,.js}'],
  // Migration file path (always consider dockerfile)
  migrations: [__dirname + '/../migrations/postgres-sub/**/*{.ts,.js}'],
  seeds: [__dirname + '/../seeds/**/*{.ts,.js}'],
  factories: [__dirname + '/../factories/**/*{.ts,.js}'],
};

export default new DataSource(dataSourceOption);
