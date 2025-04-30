import { Component, IInjectableCallback } from './component';
import { Meta } from './meta';
import { INewAble } from './types';
import { EventEmitter } from './events';
import { Context } from './context';

enum COMPONET_LIFECYCLE {
  ENDERR,
  ENDED,
  ENDING,
  DEFINED,
  INITING,
  INTED,
  INTERR,
}

export class Wrap<T extends Component = Component> extends EventEmitter {
  private readonly clazz: INewAble<T>;
  private readonly dependencies = new Map<string | symbol, Wrap<any>>();
  private readonly EVENT_ONLINE_RESOLVE = 'online:resolve';
  private readonly EVENT_ONLINE_REJECT = 'online:reject';
  private readonly EVENT_OFFLINE_RESOLVE = 'offline:resolve';
  private readonly EVENT_OFFLINE_REJECT = 'offline:reject';

  public readonly meta: Meta;
  public context: Context<T>;
  public status: COMPONET_LIFECYCLE = COMPONET_LIFECYCLE.DEFINED;
  public error: any;

  get isSingleton(): boolean {
    return this.meta?.clazz?.get(Component.SingletonNameSpace) || false;
  }

  constructor(clazz: INewAble<T>) {
    super();
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

  public start() {
    switch (this.status) {
      case COMPONET_LIFECYCLE.ENDED:
      case COMPONET_LIFECYCLE.ENDERR:
      case COMPONET_LIFECYCLE.DEFINED:
        return new Promise<void>((resolve, reject) => {
          this.status = COMPONET_LIFECYCLE.INITING;
          this.run().then(() => {
            this.status = COMPONET_LIFECYCLE.INTED;
            this.error = null;
            this.emit(this.EVENT_ONLINE_RESOLVE);
            resolve();
          }).catch(e => {
            this.status = COMPONET_LIFECYCLE.INTERR;
            this.error = e;
            this.emit(this.EVENT_ONLINE_REJECT);
            reject(e);
          })
        })
      case COMPONET_LIFECYCLE.INITING:
        return new Promise<void>((resolve, reject) => {
          const handler = () => {
            this.off(this.EVENT_ONLINE_RESOLVE, resolveHandler);
            this.off(this.EVENT_ONLINE_REJECT, rejectHandler);
          }
          const resolveHandler = () => {
            handler();
            resolve();
          }
          const rejectHandler = () => {
            handler();
            reject(this.error);
          }
          this.on(this.EVENT_ONLINE_RESOLVE, resolveHandler);
          this.on(this.EVENT_ONLINE_REJECT, rejectHandler);
        })
      case COMPONET_LIFECYCLE.INTED: return Promise.resolve();
      case COMPONET_LIFECYCLE.INTERR: return Promise.reject(this.error);
      case COMPONET_LIFECYCLE.ENDING: return Promise.reject(new Error('Component is ending'));
    }
  }

  public stop() {
    switch (this.status) {
      case COMPONET_LIFECYCLE.INTED:
        return new Promise<void>((resolve, reject) => {
          this.status = COMPONET_LIFECYCLE.ENDING;
          this.destroy().then(() => {
            this.status = COMPONET_LIFECYCLE.ENDED;
            this.error = null;
            this.emit(this.EVENT_OFFLINE_RESOLVE);
            resolve();
          }).catch(e => {
            this.status = COMPONET_LIFECYCLE.ENDERR;
            this.error = e;
            this.emit(this.EVENT_OFFLINE_REJECT);
            reject(e);
          })
        })
      case COMPONET_LIFECYCLE.ENDING:
        return new Promise<void>((resolve, reject) => {
          const handler = () => {
            this.off(this.EVENT_OFFLINE_RESOLVE, resolveHandler);
            this.off(this.EVENT_OFFLINE_REJECT, rejectHandler);
          }
          const resolveHandler = () => {
            handler();
            resolve();
          }
          const rejectHandler = () => {
            handler();
            reject(this.error);
          }
          this.on(this.EVENT_OFFLINE_RESOLVE, resolveHandler);
          this.on(this.EVENT_OFFLINE_REJECT, rejectHandler);
        })
      case COMPONET_LIFECYCLE.ENDED: return Promise.resolve();
      case COMPONET_LIFECYCLE.ENDERR: return Promise.reject(this.error);
      case COMPONET_LIFECYCLE.DEFINED: return Promise.reject(new Error('component has not been inited'));
      case COMPONET_LIFECYCLE.INITING: return Promise.reject(new Error('can not run stop method when component is initing'));
      case COMPONET_LIFECYCLE.INTERR: return Promise.reject(new Error('can not run stop method when component is init error'));
    }
  }

  private run() {
    const stacks: Promise<any>[] = [];
    for (const [property, pool] of this.meta.properties.entries()) {
      if (pool.has(Component.InjectNameSpace)) {
        const target: INewAble<Component> = pool.get(Component.InjectNameSpace);
        stacks.push(Component.preload(target)
          .then(wrap => this.dependencies.set(property, wrap)));
      }
    }
    return Promise.all(stacks).then(() => {
      if (this.isSingleton) {
        return this.create();
      }
    }).then(context => this.context = context);
  }

  private async destroy() {
    if (this.context) {
      let i = this.context.callbacks.length;
      while (i--) {
        await Promise.resolve(this.context.callbacks[i]());
      }
      this.context.clear();
    }
  }

  public async create() {
    const funcs: IInjectableCallback[] = this.meta.clazz.get(Component.InjectableNameSpace) || [];
    const context = new Context(this);
    context.value = new this.clazz();

    await Promise.all(Array.from(this.dependencies.entries()).map(([key, wrap]) => {
      return new Promise<void>((resolve, reject) => {
        if (wrap.isSingleton) {
          Object.defineProperty(context.value, key, {
            get: () => wrap.context.value,
          });
          resolve();
        } else {
          wrap.create().then(ctx => {
            Object.defineProperty(context.value, key, {
              get: () => ctx.value,
            })
            resolve();
          }).catch(reject)
        }
      })
    }))

    this.resolveWatchers(context.value);

    for (let i = 0; i < funcs.length; i++) {
      await Promise.resolve(funcs[i](context));
    }

    return context;
  }

  private resolveWatchers(component: T) {
    const Watchers = new Map<string | Symbol, Set<string | Symbol>>();

    for (const [key, widgets] of this.meta.properties.entries()) {
      if (widgets.has(Component.StateNameSpace) && widgets.get(Component.StateNameSpace)) {
        if (this.dependencies.has(key)) continue;
        if (!Watchers.has(key)) {
          Watchers.set(key, new Set());
        }
      }
    }

    for (const [key, widgets] of this.meta.methods.entries()) {
      if (widgets.has(Component.WatchNameSpace)) {
        const watcher: string | symbol = widgets.get(Component.WatchNameSpace);
        if (!Watchers.has(watcher)) continue;
        Watchers.get(watcher).add(key);
      }
    }

    for (const [key, watchers] of Watchers.entries()) {
      this.createFunctionExcution(component, key as keyof T, watchers);
    }
  }

  private createFunctionExcution(component: T, key: keyof T, watchers: Set<string | Symbol>) {
    let value = component[key];
    Object.defineProperty(component, key, {
      get: () => value,
      set: (v: any) => {
        if (value === v) return;
        const oldValue = value;
        value = v;
        for (const method of watchers.values()) {
          const fn = component[method as keyof T] as (newValue: any, oldValue: any) => void;
          if (typeof fn !== 'function') continue;
          fn(v, oldValue);
        }
      }
    })
  }
}