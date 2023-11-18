import { DataSource, EntityManager, QueryRunner, Repository } from 'typeorm';
import { TypeOrmUpdatedPatchError } from '../errors/typeorm-updated-patch';
import { storage } from '../storage';
import { isDataSource } from '../utils';
import { TYPEORM_ENTITY_MANAGER_NAME, DEFAULT_DATA_SOURCE_NAME } from './constants';
export * from './constants';

interface AddTransactionalDataSourceInput {
  /**
   * Custom name for data source
   */
  name?: DataSourceName;

  dataSource: DataSource;
}

export type DataSourceName = typeof DEFAULT_DATA_SOURCE_NAME | string;
export const dataSourceMap = new Map<DataSourceName, DataSource>();

export function getDataSource(key: DataSourceName): DataSource {
  const dataSource = dataSourceMap.get(key);

  if (dataSource === undefined) {
    throw new Error(
      'There is no registered DataSource. DataSource must be registered through addTransactionalDataSource.',
    );
  }

  return dataSource;
}

export function getStoreQueryRunner(onEmptyFail: true): QueryRunner;
export function getStoreQueryRunner(onEmptyFail?: false): QueryRunner | undefined;
export function getStoreQueryRunner(onEmptyFail = false): QueryRunner | undefined {
  const queryRunner = storage.getStore()?.data;

  if (queryRunner === undefined && onEmptyFail) {
    throw new Error('Query runner is not set in the running context.');
  }

  return queryRunner as QueryRunner;
}

export const addTransactionalDataSource = (input: AddTransactionalDataSourceInput | DataSource) => {
  if (isDataSource(input)) {
    input = { dataSource: input, name: input.name };
  }

  const { dataSource, name = 'default' } = input;
  if (dataSourceMap.has(name)) {
    throw new Error(`DataSource with name "${name}" has already added.`);
  }

  let originalManager = dataSource.manager;

  // {dataSource.manager} return context manager if exist
  Object.defineProperty(dataSource, 'manager', {
    configurable: true,
    get() {
      return getStoreQueryRunner()?.manager || originalManager;
    },
    set(manager: EntityManager) {
      originalManager = manager;
    },
  });

  const originalQuery = DataSource.prototype.query;
  if (originalQuery.length !== 3) {
    throw new TypeOrmUpdatedPatchError();
  }

  // {dataSource.query, $.manager.query} execute transaction in context
  dataSource.query = function (...args: unknown[]) {
    args[2] = args[2] || dataSource.manager?.queryRunner;
    return originalQuery.apply(this, args);
  };

  const originalCreateQueryBuilder = DataSource.prototype.createQueryBuilder;
  if (originalCreateQueryBuilder.length !== 3) {
    throw new TypeOrmUpdatedPatchError();
  }

  dataSource.createQueryBuilder = function (...args: unknown[]) {
    if (args.length === 0) {
      return originalCreateQueryBuilder.apply(this, [this.manager?.queryRunner]);
    }

    args[2] = args[2] || this.manager?.queryRunner;
    return originalCreateQueryBuilder.apply(this, args);
  };

  // {dataSource.transaction} execute transaction in context
  dataSource.transaction = function (...args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return originalManager.transaction(...args);
  };

  // {repository.manager} return context manager if exist
  Object.defineProperty(Repository.prototype, 'manager', {
    configurable: true,
    get() {
      return getStoreQueryRunner()?.manager || this[TYPEORM_ENTITY_MANAGER_NAME];
    },
    set(manager?: EntityManager) {
      this[TYPEORM_ENTITY_MANAGER_NAME] = manager;
    },
  });

  dataSourceMap.set(name, dataSource);

  return dataSource;
};
