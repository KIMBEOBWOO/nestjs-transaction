/**
 * Transaction propagation properties
 */
export const Propagation = {
  /**
   * Internal transactions participate in running external transactions (default properties)
   * @description If there is already a transaction being performed in the execution context, participate in that transaction and do not create a new physical transactions.
   */
  REQUIRED: 'REQUIRED',

  /**
   * Join if there is an external transaction
   * @description If external transactions exist, they participate and proceed, and if not, they execute without transactions.
   */
  SUPPORTS: 'SUPPORTS',

  /**
   * Execute within a nested transaction if a current transaction exists, behave like REQUIRED else.
   * @description If there is already a transaction being performed in the execution context, create Typeorm savepoint and execute it as a nested transaction.
   */
  NESTED: 'NESTED',

  /**
   * An option that always causes a method call to initiate a new transaction. This option allows the called method to run within the new transaction, even if there is a current active transaction.
   */
  REQUIES_NEW: 'REQUIES_NEW',
} as const;

/**
 * Transaction propagation properties
 */
export type PropagationType = (typeof Propagation)[keyof typeof Propagation];
