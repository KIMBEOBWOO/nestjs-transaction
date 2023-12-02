import { TransactionModuleOption } from '../interfaces';

type StoreOptionType = Pick<TransactionModuleOption, 'maxEventListeners'>;
export const DEFAUL_MAX_EVENT_LISTENERS = 100;

export const StoreOption: StoreOptionType = {
  maxEventListeners: DEFAUL_MAX_EVENT_LISTENERS,
};

// on commit and rollback event name
export const ON_COMMIT_EVENT_NAME = 'commit';
export const ON_ROLLBACK_EVENT_NAME = 'rollback';
