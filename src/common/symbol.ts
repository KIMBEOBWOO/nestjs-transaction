export const TRANSACTION_MODULE_OPTION_TOKEN = Symbol('@nestjs-transaction/typeorm-module-option');

/**
 * Transaction lazy decorator inject token
 */
export const TRANSACTION_DECORATOR = Symbol('TRANSACTION_DECORATOR');

/**
 * RollBack lazy decorator inject token
 */
export const TRANSACTION_ROLL_BACK_DECORATOR = Symbol('TRANSACTION_ROLL_BACK_DECORATOR');

const TEST_QUERY_RUNNER_TOKEN = Symbol('TEST_QUERY_RUNNER_TOKEN');
/**
 * Test QueryRunnenr Token
 */
export const getTestQueryRunnerToken = () => {
  return TEST_QUERY_RUNNER_TOKEN;
};

const TYPEORM_TRANSACTION_SERVICE_TOKEN = Symbol('TYPEORM_TRANSACTION_SERVICE_TOKEN');
/**
 * Transaciton Service Token
 * - Inject token to import TypeORMTTransactionService injected by TransactionModule
 */
export const getTransactionServiceToken = () => {
  return TYPEORM_TRANSACTION_SERVICE_TOKEN;
};

const TRANSACTION_PROVIDER_TOKEN = Symbol('@nestjs-transaction/TRANSACTION_PROVIDER_TOKEN');
export const getTransactionProviderToken = () => {
  return TRANSACTION_PROVIDER_TOKEN;
};
