import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';

export const dataSourceOption: DataSourceOptions & SeederOptions = {
  // NOTE : if use name, must be defined
  type: 'postgres',
  host: '127.0.0.1',
  port: 5435,
  username: 'beobwoo',
  password: 'testtest',
  database: 'test_db',
  // Entity file path (always consider dockerfile)
  entities: [__dirname + '/../entities/postgres-main/**/*.entity{.ts,.js}'],
  // Migration file path (always consider dockerfile)
  migrations: [__dirname + '/../migrations/postgres-main/**/*{.ts,.js}'],
  seeds: [__dirname + '/../seeds/**/*{.ts,.js}'],
  factories: [__dirname + '/../factories/**/*{.ts,.js}'],
};

export default new DataSource(dataSourceOption);
