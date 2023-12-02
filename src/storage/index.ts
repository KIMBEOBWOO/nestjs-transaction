import { AsyncLocalStorage } from 'async_hooks';

export type Store = Map<string, any>;

export interface Storage {
  get<T>(key: string): T | undefined;
  set(key: string, value: any): void;
  run<T>(cb: () => Promise<T>): Promise<T>;
}

export class ALSStroage implements Storage {
  private storage: AsyncLocalStorage<Store>;

  constructor() {
    this.storage = new AsyncLocalStorage();
  }

  private get store() {
    return this.storage.getStore() || new Map<string, any>();
  }

  public get<T>(key: string): T | undefined {
    return this.store?.get(key);
  }

  public set(key: string, value: any): void {
    this.store?.set(key, value);
  }

  public async run<T>(cb: () => Promise<T>): Promise<T> {
    return this.storage.run(this.store, cb);
  }
}

export const storage = new ALSStroage();
