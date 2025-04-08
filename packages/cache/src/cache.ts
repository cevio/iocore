import { Component, INewAble } from "@iocore/component";
import { ExtractParams } from './types';
import { CacheDispenser } from './impl';

export abstract class CacheImplementer<T extends string = string, R = any> extends Component {
  private readonly _regexp = /\{([^\:]+):[^\}]+\}/g;
  private readonly _pools: INewAble<CacheDispenser<R>>[];
  protected abstract provide(options: ExtractParams<T>): [R, number?] | Promise<[R, number?]>;
  constructor(private readonly template: T, ...pools: INewAble<CacheDispenser<R>>[]) {
    super();
    if (!pools.length) {
      throw new Error('You must select at least one cache dispenser');
    }
    this._pools = pools;
  }

  private render(options: ExtractParams<T>) {
    return this.template.replace(this._regexp, (_, key) => String(options[key as keyof typeof options]));
  }

  public async write(options: ExtractParams<T>) {
    const key = this.render(options);
    const [data, expire] = await this.provide(options);
    for (let i = 0; i < this._pools.length; i++) {
      const pool = this._pools[i];
      const model = await Component.create(pool);
      await model.set(key, data, expire);
    }
    return data;
  }

  public async read(options: ExtractParams<T>) {
    const key = this.render(options);
    const builds: CacheDispenser<R>[] = [];
    let result: R, expire: number;
    for (let i = 0; i < this._pools.length; i++) {
      const pool = this._pools[i];
      const model = await Component.create(pool);
      const has = await model.has(key);
      if (!has) {
        builds.push(model);
      } else {
        result = await model.get(key);
        expire = await model.ttl(key);
      }
    }
    if (!result) {
      result = await this.write(options);
    } else {
      let i = builds.length;
      while (i--) {
        await builds[i].set(key, result, expire);
      }
    }
    return result;
  }

  public async remove(options: ExtractParams<T>) {
    const key = this.render(options);
    for (let i = 0; i < this._pools.length; i++) {
      const pool = this._pools[i];
      const model = await Component.create(pool);
      const has = await model.has(key);
      if (has) {
        await model.delete(key);
      }
    }
  }
}