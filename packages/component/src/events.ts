type ICallback = (...args: any[]) => unknown | Promise<unknown>;

export class EventEmitter {
  private readonly stacks = new Map<string, Set<ICallback>>();

  public reset() {
    this.stacks.clear();
    return this;
  }

  public on(key: string, callback: ICallback) {
    if (!this.stacks.has(key)) {
      this.stacks.set(key, new Set());
    }
    this.stacks.get(key).add(callback);
  }

  public off(key: string, callback?: ICallback) {
    if (!this.stacks.has(key)) return;
    if (!callback) {
      this.stacks.delete(key);
      return;
    }
    const pool = this.stacks.get(key);
    if (pool.has(callback)) {
      pool.delete(callback);
      if (!pool.size) {
        this.off(key);
      }
    }
  }

  public emit(key: string, ...args: any[]) {
    if (!this.stacks.has(key)) return;
    const pool = this.stacks.get(key);
    return Promise.all(
      Array.from(pool.values())
        .map(fn => Promise.resolve(fn(...args)))
    );
  }
}