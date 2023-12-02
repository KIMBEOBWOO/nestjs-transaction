import { EventEmitter2 } from 'eventemitter2';
import {
  ON_COMMIT_EVENT_NAME,
  ON_ROLLBACK_EVENT_NAME,
  TRANSACTION_EVENT_EMIMTTER,
} from '../common';
import { storage } from '../storage';

// Transaction callback type
type TransactionCallBack = (...param: unknown[]) => Promise<unknown> | unknown;

export const runOnTransactionCommit = (cb: TransactionCallBack) => {
  runWithNewEventEmitter();
  storage.get<EventEmitter2>(TRANSACTION_EVENT_EMIMTTER)?.once(ON_COMMIT_EVENT_NAME, cb);
};

export const runOnTransactionRollback = (cb: TransactionCallBack) => {
  runWithNewEventEmitter();
  storage.get<EventEmitter2>(TRANSACTION_EVENT_EMIMTTER)?.once(ON_ROLLBACK_EVENT_NAME, cb);
};

export const emitAsyncOnCommitEvent = async () => {
  const storedEventEmitter = storage.get<EventEmitter2 | undefined>(TRANSACTION_EVENT_EMIMTTER);
  await storedEventEmitter?.emitAsync(ON_COMMIT_EVENT_NAME);
};

export const emitAsyncOnRollBackEvent = async (e: unknown) => {
  const storedEventEmitter = storage.get<EventEmitter2 | undefined>(TRANSACTION_EVENT_EMIMTTER);
  await storedEventEmitter?.emitAsync(ON_ROLLBACK_EVENT_NAME, e);
};

/**
 * If event emitter is not set, create new event emitter and set to storage
 * after that, other event emitter will not be created
 */
const runWithNewEventEmitter = () => {
  const storedEventEmitter = storage.get<EventEmitter2 | undefined>(TRANSACTION_EVENT_EMIMTTER);

  if (storedEventEmitter === undefined) {
    const eventEmitter = new EventEmitter2();
    storage.set(TRANSACTION_EVENT_EMIMTTER, eventEmitter);
  }
};
