import Component, { INewAble, Meta, Wrap } from "@iocore/component";
import { Router } from "./router";
import { Context } from './context';
import { Channel } from "@iocore/micro-ws";
import { MicroWebSocketAgent } from "./index";

export type IMiddleware = INewAble<Middleware>;
export const HttpMiddlewareNameSpace = Symbol('#Controller.Middleware');
export type Next = () => Promise<void>;
export type TMiddleware = (ctx: Context, next: Next) => Promise<void>;

export abstract class Middleware extends Router {
  public abstract use(ctx: Context, next: Next): Promise<unknown>;
  static Dependencies(...args: IMiddleware[]) {
    return Meta.createClassDecorator<IMiddleware[]>(HttpMiddlewareNameSpace, ({ value }) => {
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

  static async get(wrap: Wrap, channel: Channel, agent: MicroWebSocketAgent) {
    const middlewares = await orderMiddlewares(wrap);
    return transformMiddlewares(middlewares, channel, agent);
  }

  static compose(middleware: TMiddleware[]) {
    return async (ctx: Context, next?: Next) => {
      const dispatch = (i: number) => async () => {
        const fn = i === middleware.length
          ? next
          : middleware[i]
        if (!fn) return
        return await fn(ctx, dispatch(i + 1));
      }
      return dispatch(0)()
    }
  }
}

async function orderMiddlewares(wrap: Wrap) {
  if (!wrap.meta.clazz.has(HttpMiddlewareNameSpace)) return [];
  const middlewares: IMiddleware[] = wrap.meta.clazz.get(HttpMiddlewareNameSpace);
  if (!middlewares.length) return [];
  const pool: IMiddleware[] = [];
  for (let i = 0; i < middlewares.length; i++) {
    const middleware = middlewares[i];
    const wrap = await Component.preload(middleware as INewAble<Middleware>);
    const orders = await orderMiddlewares(wrap);
    pool.push(...orders);
  }
  return Array.from(new Set(pool.concat(middlewares)).values());
}

function transformMiddlewares(middlewares: IMiddleware[], channel: Channel, agent: MicroWebSocketAgent): TMiddleware[] {
  return (middlewares || []).map(middleware => {
    const current = middleware as INewAble<Middleware>;
    const _middleware: TMiddleware = async (ctx, next) => {
      const wrap = await Component.preload(current);
      const transformer = Router.getInComing(wrap);
      const cmp = await wrap.create();
      Object.defineProperty(cmp.value, 'channel', { value: channel });
      Object.defineProperty(cmp.value, 'agent', { value: agent });
      await transformer(ctx, cmp.value);
      await cmp.value.use(ctx, next);
    }
    return _middleware;
  })
}