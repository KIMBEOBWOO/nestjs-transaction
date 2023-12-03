export interface StoreOption {
  /**
   * Set the maximum number of event listeners for the transaction.
   * - If you set a value greater than 'maxEventListeners', you will see a warning.
   *
   * @default 100
   * @NOTE [EventEmitter2 Docs](https://www.npmjs.com/package/eventemitter2) for more information.
   */
  maxEventListeners: number;
}

export const DEFAUL_MAX_EVENT_LISTENERS = 100;

/**
 * StoreOption is a global option for the transaction module.
 */
export const storeOption: StoreOption = {
  maxEventListeners: DEFAUL_MAX_EVENT_LISTENERS,
};

// on commit event name
export const ON_COMMIT_EVENT_NAME = 'commit';
// on rollback event name
export const ON_ROLLBACK_EVENT_NAME = 'rollback';
