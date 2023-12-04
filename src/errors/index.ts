export class TransactionalError extends Error {
  public name = 'TransactionalError';
}

export class NoRegistedDataSourceError extends TransactionalError {
  public name = 'NoRegistedDataSourceError';

  constructor() {
    super(
      'There is no registered DataSource. DataSource must be registered through addTransactionalDataSource.',
    );
  }
}

export class TypeOrmUpdatedPatchError extends TransactionalError {
  public name = 'TypeOrmUpdatedPatchError';

  constructor() {
    super(
      'It seems that TypeORM was updated. Patching "DataSource" is not safe. If you want to try to use the library, set the "patch" flag in the function "addTransactionalDataSource" to "false".',
    );
  }
}

/**
 * Error that occurs when a transaction is not rolled back
 */
export class NotRollBackError extends TransactionalError {
  constructor(
    /**
     * Original error that occurred during transaction
     */
    readonly originError: unknown,
  ) {
    super(originError instanceof Error ? originError.message : 'NotRollBackError');
  }
}
