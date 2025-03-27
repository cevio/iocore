import { Component } from './component';
import { Meta } from './meta';
import { INewAble } from './types';
import { EventEmitter } from 'node:events';

export class Wrap<T extends Component = Component> extends EventEmitter {
  private readonly clazz: INewAble<T>;
  private readonly dependencies = new Map<string | symbol, Component>();

  public readonly meta: Meta;
  public instance: T;
  public status: 0 | 1 | 2 = 0;

  get isSingleton(): boolean {
    return this.meta?.clazz?.get(Component.SingletonNameSpace) || false;
  }

  constructor(clazz: INewAble<T>) {
    super();
    this.setMaxListeners(+Infinity);
    this.meta = Meta.get(clazz);

    if (!this.meta.clazz.has(Component.InjectableNameSpace)) {
      throw new Error('miss `@Component.Injectable()` decorator');
    }

    this.clazz = new Proxy(clazz, {
      construct(target, args) {
        const obj = new target(...args);

        if (!(obj instanceof Component)) {
          throw new Error('target must extends from `Component`');
        }

        return obj;
      }
    })
  }

  public load() {
    switch (this.status) {
      case 0: return new Promise<void>(resolve => {
        const handler = () => {
          this.off('ok', handler);
          resolve();
        }
        this.status = 1;
        this.on('ok', handler);
        this.dispatch();
      })
      case 1: return new Promise<void>(resolve => {
        const handler = () => {
          this.off('ok', handler);
          resolve();
        }
        this.on('ok', handler);
      })
      case 2: return Promise.resolve();
    }
  }

  private dispatch() {
    const stacks: Promise<any>[] = [];
    for (const [property, pool] of this.meta.properties.entries()) {
      if (pool.has(Component.InjectNameSpace)) {
        const target: INewAble<Component> = pool.get(Component.InjectNameSpace);

        stacks.push(Component.create(target)
          .then(component => this.dependencies.set(property, component)));
      }
    }
    return Promise.all(stacks).then(() => {
      for (const key of this.dependencies.keys()) {
        Object.defineProperty(this.clazz.prototype, key, {
          get: () => this.dependencies.get(key),
        })
      }

      if (this.isSingleton) {
        return this.create().then(component => this.instance = component);
      }
    }).then(() => {
      this.status = 2;
      this.emit('ok');
    });
  }

  public async create(...args: any[]) {
    const funcs: Function[] = this.meta.clazz.get(Component.InjectableNameSpace);
    const target = new this.clazz(...args);
    for (let i = 0; i < funcs.length; i++) {
      await Promise.resolve(funcs[i](target, this));
    }
    return target;
  }
}