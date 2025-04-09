import { CacheDispenser } from "@iocore/cache";
import Component, { Application, INewAble } from "@iocore/component";
import { Static, TObject } from '@sinclair/typebox';

export * from '@sinclair/typebox';
export abstract class Configs<T extends TObject = TObject> extends Application {
  private readonly state = new Map();
  private readonly dispensers: INewAble<CacheDispenser<Static<T>>>[];

  constructor(
    private readonly namespace: string,
    private readonly schema: T,
    ...dispensers: INewAble<CacheDispenser<Static<T>>>[]
  ) {
    super();
    this.dispensers = dispensers;
  }

  private createKey() {
    return (process.env.CACHE_PREFIX || '') + 'variable:' + this.namespace + ':state';
  }

  private async read() {
    const key = this.createKey();
    let result: Static<T>;
    for (let i = 0; i < this.dispensers.length; i++) {
      const dispenser = this.dispensers[i];
      const model = await Component.create(dispenser);
      const has = await model.has(key);
      if (has) {
        result = await model.get(key);
        break;
      }
    }
    return result;
  }

  public async initialize() {
    for (const key in this.schema.properties) {
      const fieldSchema = this.schema.properties[key];
      this.state.set(key, fieldSchema.default);
    }

    const _state = await this.read();
    if (_state) {
      for (const key of this.state.keys()) {
        if (_state[key as any] !== undefined) {
          this.state.set(key, _state[key as any]);
        }
      }
    }
  }

  public terminate() { }

  public get<U extends keyof Static<T>>(key: U): Static<T>[U] {
    return this.state.get(key);
  }

  public set<U extends keyof Static<T>>(key: U, value: Static<T>[U]) {
    this.state.set(key, value);
    return this;
  }

  public async save(value: Partial<Static<T>>) {
    for (const key in value) {
      this.set(key, value[key]);
    }
    let i = this.dispensers.length;
    const key = this.createKey();
    const _value = this.toValue();
    while (i--) {
      const dispenser = this.dispensers[i];
      const model = await Component.create(dispenser);
      await model.set(key, _value);
    }
    return _value;
  }

  public toValue() {
    const data: Static<T> = {};
    for (const [key, value] of this.state.entries()) {
      data[key] = value;
    }
    return data;
  }

  public toSchema() {
    return this.schema;
  }
}