import { AsyncLocalStorage } from 'async_hooks';

export type Store = Map<string, any>;

export class ALSStroage {
  private storage: AsyncLocalStorage<Store>;

  constructor() {
    this.storage = new AsyncLocalStorage();
  }

  get store() {
    return this.storage.getStore() || new Map<string, any>();
  }

  set store(store: Store) {
    this.storage.enterWith(new Map<string, any>());
  }

  public get<T>(key: string): T {
    return this.store?.get(key);
  }

  public set(key: string, value: any): void {
    this.store?.set(key, value);
  }

  public async run<T>(cb: () => Promise<T>): Promise<T> {
    return this.storage.run(this.store, cb);
  }

  enterWithEmptyStore(): void {
    this.storage.enterWith(new Map<string, any>());
  }
}

export const storage = new ALSStroage();
