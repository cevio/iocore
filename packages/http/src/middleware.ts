import Component, { INewAble, Meta, Wrap } from "@iocore/component";
import { Middleware as KoaMiddleware, Next } from 'koa';
import { Router, transformInComingMetadata } from "./router";

export type IMiddleware = KoaMiddleware | INewAble<Middleware>;
const HttpMiddlewareNamespace = Symbol('#Middleware');

@Component.Injectable()
export abstract class Middleware extends Router {
  static readonly isMiddleware = true;
  public abstract use(next: Next): Promise<unknown>;

  static Dependencies(...args: IMiddleware[]) {
    return Meta.createClassDecorator<IMiddleware[]>(HttpMiddlewareNamespace, ({ value }) => {
      const _value = value ?? [];
      for (let i = 0; i < args.length; i++) {
        const current = args[i];
        if (!_value.includes(current)) {
          _value.push(current);
        }
      }
      return _value;
    })
  }
}

export async function getMiddlewares(wrap: Wrap) {
  const middlewares = await orderMiddlewares(wrap);
  return transformMiddlewares(middlewares);
}

async function orderMiddlewares(wrap: Wrap) {
  if (!wrap.meta.clazz.has(HttpMiddlewareNamespace)) return [];
  const middlewares: IMiddleware[] = wrap.meta.clazz.get(HttpMiddlewareNamespace);
  const pool: IMiddleware[] = [];
  for (let i = 0; i < middlewares.length; i++) {
    const middleware = middlewares[i];
    // @ts-ignore
    if (middleware.isMiddleware) {
      const wrap = await Component.preload(middleware as INewAble<Middleware>);
      const orders = await orderMiddlewares(wrap);
      pool.push(...orders);
    }
  }
  return Array.from(new Set(pool.concat(middlewares)).values());
}

function transformMiddlewares(middlewares: IMiddleware[]): KoaMiddleware[] {
  return middlewares.map(middleware => {
    // @ts-ignore
    if (middleware.isMiddleware) {
      const current = middleware as INewAble<Middleware>;
      const _middleware: KoaMiddleware = async (ctx, next) => {
        const wrap = await Component.preload(current);
        const transformer = transformInComingMetadata(wrap);
        const cmp = await wrap.create();
        await transformer(ctx, cmp);
        await cmp.value.use(next);
      }
      return _middleware;
    } else {
      return middleware as KoaMiddleware;
    }
  })
}