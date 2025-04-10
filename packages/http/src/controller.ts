import { Meta } from '@iocore/component';
import { HTTPMethod } from "find-my-way";
import { Context, Next } from 'koa';
import { IMiddleware } from './middleware';
import { Router } from './router';

export const HttpMethodNameSpace = Symbol('#Controller.Method');
export const HttpDeprecatedNameSpace = Symbol('#Controller.Deprecated');
export const HttpMiddlewareNameSpace = Symbol('#Controller.Middleware');

export abstract class Controller<T = any> extends Router {
  protected readonly ctx: Context;
  public abstract response(next: Next): T | Promise<T>;
  static readonly Deprecated = Meta.createClassDecorator(HttpDeprecatedNameSpace, () => true);
  static Method(...args: HTTPMethod[]) {
    return Meta.createClassDecorator<HTTPMethod[]>(HttpMethodNameSpace, ({ value }) => {
      const _value = value ?? [];
      for (let i = 0; i < args.length; i++) {
        if (!_value.includes(args[i])) {
          _value.push(args[i]);
        }
      }
      return _value;
    })
  }

  static Middleware(...args: IMiddleware[]) {
    return Meta.createClassDecorator<IMiddleware[]>(HttpMiddlewareNameSpace, ({ value }) => {
      const _value = value ?? [];
      for (let i = 0; i < args.length; i++) {
        if (!_value.includes(args[i])) {
          _value.push(args[i]);
        }
      }
      return _value;
    })
  }
}