import { AsyncLocalStorage } from 'async_hooks';

export interface Store<T = unknown> {
  /* Unique key value each store has */
  seqId: string;
  /* QueryRunner currently in use in the request context */
  data: T;
}

export const storage = new AsyncLocalStorage<Store>();
