import compose from 'koa-compose';
import { Component } from "@iocore/component";
import { Middleware } from 'koa';

@Component.Singleton
@Component.Injectable()
export class HttpMiddlewareHooks extends Component {
  private readonly prefixs = new Set<Middleware>();
  private readonly suffixs = new Set<Middleware>();

  public add(type: 'prefix' | 'suffix', ...middlewares: Middleware[]) {
    const target = type === 'prefix' ? this.prefixs : this.suffixs;
    for (let i = 0; i < middlewares.length; i++) {
      target.add(middlewares[i]);
    }
    return this;
  }

  public del(type: 'prefix' | 'suffix', ...middlewares: Middleware[]) {
    const target = type === 'prefix' ? this.prefixs : this.suffixs;
    for (let i = 0; i < middlewares.length; i++) {
      const middleware = middlewares[i];
      if (target.has(middleware)) {
        target.delete(middleware);
      }
    }
    return this;
  }

  public compose(type: 'prefix' | 'suffix'): Middleware {
    const target = type === 'prefix' ? this.prefixs : this.suffixs;
    return async (ctx, next) => {
      if (!target.size) return await next();
      const middlewares = Array.from(target.values());
      const composed = compose(middlewares);
      await composed(ctx, next);
    }
  }
}