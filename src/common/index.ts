import { DataSource, EntityManager, QueryRunner, Repository } from 'typeorm';
import { NoRegistedDataSourceError, TypeOrmUpdatedPatchError } from '../errors';
import { storage } from '../storage';
import { isDataSource } from '../utils';
import {
  TYPEORM_ENTITY_MANAGER_NAME,
  TYPEORM_DEFAULT_DATA_SOURCE_NAME,
  TYPEORM_DATA_SOURCE_NAME,
} from './constants';

export * from './constants';
export * from './symbol';
export * from './store';

interface AddTransactionalDataSourceInput {
  /**
   * Custom name for data source
   */
  name?: DataSourceName;

  dataSource: DataSource;
}

export type DataSourceName = typeof TYPEORM_DEFAULT_DATA_SOURCE_NAME | string;
const dataSourceMap = new Map<DataSourceName, DataSource>();

export function getDataSource(key: DataSourceName): DataSource {
  const dataSource = dataSourceMap.get(key);

  if (dataSource === undefined) {
    throw new NoRegistedDataSourceError();
  }

  return dataSource;
}

export const initializeTransactionalContext = () => {
  // {repository.manager} return context manager if exist
  Object.defineProperty(Repository.prototype, 'manager', {
    configurable: true,
    get() {
      return (
        getStoreQueryRunner(
          this[TYPEORM_ENTITY_MANAGER_NAME].connection[TYPEORM_DATA_SOURCE_NAME] as DataSourceName,
        )?.manager || this[TYPEORM_ENTITY_MANAGER_NAME]
      );
    },
    set(manager?: EntityManager) {
      this[TYPEORM_ENTITY_MANAGER_NAME] = manager;
    },
  });
};

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
      return (
        getStoreQueryRunner(this[TYPEORM_DATA_SOURCE_NAME] as DataSourceName)?.manager ||
        originalManager
      );
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
    args[2] = args[2] || this.manager?.queryRunner;
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

  dataSourceMap.set(name, dataSource);
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  dataSource[TYPEORM_DATA_SOURCE_NAME] = name;
  // storage.resetContext(name);

  return dataSource;
};

/**
 * Get current stored queryRunner from context
 * @param dataSourceName name of data source
 * @returns QueryRunner, if queryRunner is exist
 * @returns undefined, if queryRunner is not exist
 */
function getStoreQueryRunner(dataSourceName: DataSourceName): QueryRunner | undefined {
  // const queryRunner: QueryRunner | undefined =
  //   storage.getContext<QueryRunner>(dataSourceName)?.data;

  // return queryRunner;

  const queryRunner = storage.get<QueryRunner>(dataSourceName);
  return queryRunner;
}
