import Component, { Meta, Wrap } from "@iocore/component";
import { Context } from "koa";

const HttpInComingHeadNamespace = Symbol('#Controller.InComing.Head');
const HttpInComingQueryNamespace = Symbol('#Controller.InComing.Query');
const HttpInComingPathNamespace = Symbol('#Controller.InComing.Path');
const HttpInComingBodyNamespace = Symbol('#Controller.InComing.Body');

export class Router extends Component {
  static readonly InComing = Object.freeze({
    Head(key?: string | Function, ...callbacks: Function[]) {
      return Meta.createPropertyDecorator(HttpInComingHeadNamespace, ({ property }) => {
        return {
          callbacks: typeof key === 'function' ? [key].concat(callbacks) : callbacks,
          key: typeof key === 'string' ? key : property,
        }
      })
    },
    Query(key?: string | Function, ...callbacks: Function[]) {
      return Meta.createPropertyDecorator(HttpInComingQueryNamespace, ({ property }) => {
        return {
          callbacks: typeof key === 'function' ? [key].concat(callbacks) : callbacks,
          key: typeof key === 'string' ? key : property,
        }
      })
    },
    Path(key?: string | Function, ...callbacks: Function[]) {
      return Meta.createPropertyDecorator(HttpInComingPathNamespace, ({ property }) => {
        return {
          callbacks: typeof key === 'function' ? [key].concat(callbacks) : callbacks,
          key: typeof key === 'string' ? key : property,
        }
      })
    },
    Body(...callbacks: Function[]) {
      return Meta.createPropertyDecorator(HttpInComingBodyNamespace, () => callbacks);
    }
  })

  static getInComing(wrap: Wrap<Router>) {
    const proxy = new Map<string | symbol, (ctx: Context) => () => Promise<any>>();
    for (const [property, item] of wrap.meta.properties.entries()) {
      if (item.has(HttpInComingHeadNamespace)) {
        const { key, callbacks } = item.get(HttpInComingHeadNamespace);
        proxy.set(property, (ctx: Context) => () => transformInComingCallbacks(ctx.headers[key], callbacks));
      } else if (item.has(HttpInComingQueryNamespace)) {
        const { key, callbacks } = item.get(HttpInComingQueryNamespace);
        proxy.set(property, (ctx: Context) => () => transformInComingCallbacks(ctx.query[key], callbacks));
      } else if (item.has(HttpInComingPathNamespace)) {
        const { key, callbacks } = item.get(HttpInComingPathNamespace);
        proxy.set(property, (ctx: Context) => () => transformInComingCallbacks(ctx.params[key], callbacks));
      } else if (item.has(HttpInComingBodyNamespace)) {
        const callbacks = item.get(HttpInComingBodyNamespace);
        // @ts-ignore
        proxy.set(property, (ctx: Context) => () => transformInComingCallbacks(ctx.request.body, callbacks));
      }
    }
    return async (ctx: Context, controller: Component) => {
      for (const [property, callback] of proxy.entries()) {
        const fn = callback(ctx);
        // @ts-ignore
        controller[property] = await fn();
      }
    }
  }
}

async function transformInComingCallbacks<T = any, R = any>(value: T, callbacks: ((v: any) => any)[]): Promise<R> {
  let _value: any = value;
  for (let i = 0; i < callbacks.length; i++) {
    const callback = callbacks[i];
    _value = await Promise.resolve(callback(_value));
  }
  return _value as R;
}