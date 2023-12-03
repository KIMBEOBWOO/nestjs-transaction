export const TRANSACTION_MODULE_OPTION_TOKEN = Symbol('@nestjs-transaction/typeorm-module-option');

/**
 * Transaction decorator inject token
 */
export const TRANSACTION_DECORATOR = Symbol('TRANSACTION_DECORATOR');
/**
 * Event listener decorator inject token
 */
export const TRANSACTION_EVENT_LISTENER_DECORATOR = Symbol('TRANSACTION_EVENT_LISTENER_DECORATOR');

const TEST_QUERY_RUNNER_TOKEN = Symbol('TEST_QUERY_RUNNER_TOKEN');
/**
 * Test QueryRunnenr Token
 */
export const getTestQueryRunnerToken = () => {
  return TEST_QUERY_RUNNER_TOKEN;
};
