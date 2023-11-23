import { DataSourceName } from '../common';
import { IsolationLevelType, PropagationType } from '../enums';

export interface TransactionOptions {
  /**
   * Database Connection Name
   */
  connectionName?: string;

  /**
   * Set transaction isolation level options
   * @default 'READ COMMITTED' Read committed history only
   */
  isolationLevel?: IsolationLevelType;

  /**
   * Transaction propagation level setting options
   * @default 'REQUIRED' Internal transactions participate in running external transactions (default properties)
   */
  propagation?: PropagationType;
}

export interface TransactionModuleOption {
  /**
   * Locate the entered data source name and register it as a transaction data source.
   * If that value is not entered, it automatically registers all data sources.
   *
   * @NOTE [Nestjs Docs](https://docs.nestjs.com/techniques/database),
   * If you are using TypeOrmModule.forRootAsync, you have to also set the "data source name" outside useFactory
   * and add the name you set to the property
   */
  dataSourceNames?: DataSourceName[];
}
