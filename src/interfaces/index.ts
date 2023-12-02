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

  /**
   * Set the maximum number of event listeners for the transaction.
   * - If you set a value greater than 'maxEventListeners', you will see a warning.
   *
   * @default 100
   * @NOTE [EventEmitter2 Docs](https://www.npmjs.com/package/eventemitter2) for more information.
   */
  maxEventListeners?: number;
}

/**
 * Transaction lifecycle Hook interface
 *
 * @example ```ts
 * export class TestTransaction implements Transaction {
 * constructor(@Inject('TestService') private readonly testService: TestService) {}
 *
 *  async onCommit(...param: unknown[]) {
 *      await this.testService.test();
 *  }
 *}
 * ```
 */
export interface TransactionEventListener {
  /**
   * After the transaction is committed, the onCommit method is called.
   * @param param
   */
  onCommit(...param: unknown[]): unknown;

  /**
   * After the transaction is rolled back, the onRollBack method is called.
   * @param param
   */
  onRollBack(...param: unknown[]): unknown;
}
