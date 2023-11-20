import { AsyncLocalStorage } from 'async_hooks';

export interface Store<T = unknown> {
  /* Data held in the current request context */
  data: T;
}

interface Storage {
  setContext(key: string): void;
  getContext<DataType>(key: string): Store<DataType> | undefined;
  run(key: string, newContext: Store, callback: () => unknown): unknown;
}

export class ContextStorage implements Storage {
  private readonly _storageMap: Map<string, AsyncLocalStorage<Store>>;

  constructor() {
    this._storageMap = new Map();
  }

  setContext(key: string) {
    this._storageMap.set(key, new AsyncLocalStorage());
  }

  getContext<DataType>(key: string) {
    return this._storageMap.get(key)?.getStore() as Store<DataType>;
  }

  run(key: string, newContext: Store, callback: () => unknown) {
    const storage = this._storageMap.get(key);

    if (!storage) {
      throw new Error(
        'There is no registered DataSource. DataSource must be registered through addTransactionalDataSource.',
      );
    }

    return storage.run(newContext, callback);
  }
}

export const storage = new ContextStorage();
