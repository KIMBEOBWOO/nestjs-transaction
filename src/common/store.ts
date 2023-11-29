/**
 * Store interface for save query runner and event emitter
 */

import { EventEmitter2 } from 'eventemitter2';
import { QueryRunner } from 'typeorm';
import { DataSourceName, getDataSource } from '.';
import { TransactionalError } from '../errors';
import { Transaction } from '../interfaces';
import { Store, storage } from '../storage';

/**
 * Get store from storage or create new one
 * @param dataSourceName Data source name, default is 'default'
 * @returns Store
 *
 * @throws {TransactionalError} Active store is not found
 */
export const getStore = (dataSourceName: DataSourceName): Store<QueryRunner> => {
  const activeStore = storage.getContext<QueryRunner>(dataSourceName);

  if (!activeStore) {
    throw new TransactionalError('Active store is not found');
  }

  return activeStore;
};

/**
 * Create new store and return it
 * @param dataSourceName Data source name, default is 'default'
 * @returns Store
 */
export const createStore = (dataSourceName: DataSourceName): Store<QueryRunner> => {
  return {
    data: getDataSource(dataSourceName).createQueryRunner(),
    eventEmitter: createStoreEventEmitter(),
  };
};

/**
 * Get status of current store
 * @param dataSourceName Data source name, default is 'default'
 * @returns True if store has active transaction
 */
export const hasActiveTransactionStore = (dataSourceName: DataSourceName): boolean => {
  const store = storage.getContext(dataSourceName);

  return (
    store !== undefined &&
    store.data !== undefined &&
    (store.data as QueryRunner)?.isTransactionActive
  );
};

// on commit and rollback event name
export const ON_COMMIT_EVENT_NAME = 'commit';
export const ON_ROLLBACK_EVENT_NAME = 'rollback';

/**
 * Add on commit listener to store
 * @param store Active Store
 * @param transaction Transaction
 * @throws {TransactionalError} Event emitter is not found
 */
export const addOnCommitListenerToStore = async (
  store: Store<QueryRunner>,
  transaction: Transaction,
) => {
  if (store?.eventEmitter === undefined) {
    throw new TransactionalError('Event emitter is not found');
  }

  store.eventEmitter.once(ON_COMMIT_EVENT_NAME, async () => {
    await transaction.onCommit();
  });
};

/**
 * Add on rollback listener to store
 * @param store Active Store
 * @param transaction Transaction
 * @throws {TransactionalError} Event emitter is not found
 */
export const addOnRollBackListenerToStore = async (
  store: Store<QueryRunner>,
  transaction: Transaction,
) => {
  if (store?.eventEmitter === undefined) {
    throw new TransactionalError('Event emitter is not found');
  }

  store.eventEmitter.once(ON_ROLLBACK_EVENT_NAME, async () => {
    await transaction.onRollBack();
  });
};

/**
 * Emit on commit event
 * @param store Active Store
 */
export const emitOnCommitEvent = async (store: Store<QueryRunner>) => {
  if (store?.eventEmitter !== undefined && store.eventEmitter.hasListeners(ON_COMMIT_EVENT_NAME)) {
    await store.eventEmitter.emitAsync(ON_COMMIT_EVENT_NAME);
  }
};

/**
 * Emit on rollback event
 * @param store Active Store
 */
export const emitOnRollBackEvent = async (store: Store<QueryRunner>) => {
  if (
    store?.eventEmitter !== undefined &&
    store.eventEmitter.hasListeners(ON_ROLLBACK_EVENT_NAME)
  ) {
    await store.eventEmitter.emitAsync(ON_ROLLBACK_EVENT_NAME);
  }
};

/**
 * Create new event emitter and return it
 * @returns EventEmitter2
 */
const createStoreEventEmitter = (): EventEmitter2 => {
  return new EventEmitter2({
    /**
     * NOTE : if overflows maxListeners, it will throw an "TypeError: The "warning" argument must be of type string or an instance of Error. Received an instance of Error"
     */
    maxListeners: 10,
    ignoreErrors: false,
  });
};
