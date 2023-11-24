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

/**
 * Executable Custom Transaction Features
 * @description In order to define and apply executable custom transaction functions, the interface must be implemented.
 * @example ```tsx
 * export class ImageStorageTransaction implements ExecutableTransaction {
 *    async runInNewTransaction(runOriginal: () => any, imageKey: string, file: File) {
 *      try {
 *        await this.s3Service.upload(key, file);
 *        await this.imageRepository.save(Image.create(key));
 *      } catch(e){
 *        await this.s3Serivce.deleteIfExist(key);
 *        throw e;
 * ...
 * ```
 * For example, if you want to define a series of functions that store images in cloud storage
 * and store image key information in a database as custom transactions,
 * add 'Image Storage Transaction' that implements 'Executable Transaction' as above.
 */
export interface ExecutableTransaction {
  /**
   * Flag that executable transaction is running
   */
  isActive(...param: unknown[]): boolean;
  /**
   * Define the ability to participate in ongoing transactions
   */
  joinInCurrentTransaction(...param: unknown[]): unknown;
  /**
   * Define new transactions and functionality in the event of normal processing or errors
   */
  runInNewTransaction(...param: unknown[]): unknown;
}
