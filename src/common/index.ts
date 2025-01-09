import { DataSource, EntityManager, QueryRunner, Repository } from 'typeorm';
import { NoRegistedDataSourceError, TypeOrmUpdatedPatchError } from '../errors';
import { storage } from '../storage';
import { isDataSource } from '../utils';
import {
  TYPEORM_ENTITY_MANAGER_NAME,
  TYPEORM_DEFAULT_DATA_SOURCE_NAME,
  TYPEORM_DATA_SOURCE_NAME,
  TYPEORM_ENTITY_MANAGER_QUERY_RUNNER_NAME,
} from './constants';

export * from './constants';
export * from './symbol';
export * from './store';

interface AddTransactionalDataSourceInput {
  /**
   * Custom name for data source
   */
  name?: DataSourceName;

  /**
   * Data source, which will be used for @Transactional decorator
   */
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

  /**
   * Redeclare {EntityManager.queryRunner} to get queryRunner from context
   * - see https://github.com/typeorm/typeorm/blob/master/src/persistence/EntityPersistExecutor.ts#L20
   * - If queryRunner is exist in context, return context queryRunner
   * - If queryRunner is not exist in context, return original queryRunner
   */
  Object.defineProperty(dataSource.manager, 'queryRunner', {
    configurable: true,
    get() {
      const originalQueryRunner = this[TYPEORM_ENTITY_MANAGER_QUERY_RUNNER_NAME] as QueryRunner;
      const storedQueryRunner = getStoreQueryRunner(
        this.connection[TYPEORM_DATA_SOURCE_NAME] as DataSourceName,
      );

      if (storedQueryRunner) {
        return storedQueryRunner;
      }

      return originalQueryRunner;
    },
    set(queryRunner: QueryRunner) {
      this[TYPEORM_ENTITY_MANAGER_QUERY_RUNNER_NAME] = queryRunner;
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

  return dataSource;
};

/**
 * Get current stored queryRunner from context
 * @param dataSourceName name of data source
 * @returns QueryRunner, if queryRunner is exist
 * @returns undefined, if queryRunner is not exist
 */
function getStoreQueryRunner(dataSourceName: DataSourceName): QueryRunner | undefined {
  const queryRunner = storage.get<QueryRunner>(dataSourceName);
  return queryRunner;
}
