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
