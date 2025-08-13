import { Router } from "./router";
import Component, { INewAble, Meta } from "@iocore/component";
import { HttpMiddlewareNameSpace, IMiddleware } from "./middleware";
import { Service } from "./service";

export interface ControllerResponse<T = any> {
  body: T,
  headers?: Record<string, string | string[]>,
  cookie?: Record<string, CookieSetOption>,
  redirect?: string,
}

export interface ControllerRequest<T = any> {
  headers: Record<string, string | string[]>
  query: Record<string, string | string[]>,
  params: Record<string, string>,
  cookie: Record<string, string>,
  body: T,
}

export interface CookieSetOption {
  value: string,
  maxAge?: number | undefined;
  expires?: Date | undefined;
  path?: string | undefined;
  domain?: string | undefined;
  secure?: boolean | undefined;
  secureProxy?: boolean | undefined;
  httpOnly?: boolean | undefined;
  sameSite?: "strict" | "lax" | "none" | boolean | undefined;
  signed?: boolean | undefined;
  overwrite?: boolean | undefined;
  priority?: "low" | "medium" | "high" | undefined;
  partitioned?: boolean | undefined;
}

export abstract class Controller extends Router {
  public abstract response(): ControllerResponse | Promise<ControllerResponse>;

  static Middleware(...args: IMiddleware[]) {
    return Meta.createClassDecorator(HttpMiddlewareNameSpace, ({ value }) => {
      const _value = value ?? [];
      for (let i = 0; i < args.length; i++) {
        if (!_value.includes(args[i])) {
          _value.push(args[i]);
        }
      }
      return _value;
    })
  }

  static Invoke<T extends Component>(clazz: INewAble<T>) {
    return Controller.Inject(clazz, (a: T, b: Controller) => {
      // @ts-ignore
      if (!a.channel) {
        Object.defineProperty(a, 'channel', {
          get: () => b.channel,
        });
      }

      // @ts-ignore
      if (!a.agent) {
        Object.defineProperty(a, 'agent', {
          get: () => b.agent,
        });
      }
    })
  }

  protected compatible<T extends Service>(target: T) {
    if (target instanceof Service) {
      // @ts-ignore
      if (!target.channel) {
        Object.defineProperty(target, 'channel', {
          get: () => this.channel
        });
      }

      // @ts-ignore
      if (!target.agent) {
        Object.defineProperty(target, 'agent', {
          get: () => this.agent
        });
      }
    }

    return target;
  }
}