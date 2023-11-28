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

const TRANSACTION_PROVIDER_TOKEN = Symbol('TRANSACTION_PROVIDER_TOKEN');
/**
 * Transaction Provider Token
 */
export const getTransactionProviderToken = () => {
  return TRANSACTION_PROVIDER_TOKEN;
};
