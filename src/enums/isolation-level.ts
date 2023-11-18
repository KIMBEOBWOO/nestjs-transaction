/**
 * Enumeration that represents transaction isolation levels for use with the {@link Transactional} annotation
 */
export const IsolationLevel = {
  /**
   * A constant indicating that dirty reads, non-repeatable reads and phantom reads can occur.
   */
  READ_UNCOMMITTED: 'READ UNCOMMITTED',
  /**
   * A constant indicating that dirty reads are prevented; non-repeatable reads and phantom reads can occur.
   */
  READ_COMMITTED: 'READ COMMITTED',
  /**
   * A constant indicating that dirty reads and non-repeatable reads are prevented; phantom reads can occur.
   */
  REPEATABLE_READ: 'REPEATABLE READ',
  /**
   * A constant indicating that dirty reads, non-repeatable reads and phantom reads are prevented.
   */
  SERIALIZABLE: 'SERIALIZABLE',
} as const;

export type IsolationLevelType = (typeof IsolationLevel)[keyof typeof IsolationLevel];
