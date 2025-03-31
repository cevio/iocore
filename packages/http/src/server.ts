import Koa from 'koa';
import FindMyWay, { Instance } from './find-my-way';
import Component, { Application, INewAble } from "@iocore/component";
import { randomBytes } from 'node:crypto';
import { Config, HTTPVersion, HTTPMethod } from 'find-my-way';
import { createServer, Server } from 'node:http';
import { HttpMiddlewareHooks } from "./hooks";
import { Controller, HttpDeprecatedNameSpace, HttpMethodNameSpace } from "./controller";
import { transformInComingMetadata } from './router';
import { getMiddlewares } from './middleware';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      IOCORE_HTTP_CONFIGS: {
        port: number,
        keys?: string[],
        defaultSuffix?: string,
      } & Omit<Config<HTTPVersion.V1>, 'defaultRoute'>,
    }
  }
}

@Application.Server
export class Http extends Application {
  public koa: Koa;
  public app: Instance;
  public server: Server;
  public keys: string[];
  public port: number;

  @Application.Inject(HttpMiddlewareHooks)
  public readonly hooks: HttpMiddlewareHooks;

  protected async initialize() {
    if (!process.env.IOCORE_HTTP_CONFIGS) {
      throw new Error('`@iocore/http` miss configs: IOCORE_HTTP_CONFIGS');
    }
    const props = process.env.IOCORE_HTTP_CONFIGS;
    const koa = new Koa();
    const keys = koa.keys = Array.isArray(props.keys)
      ? props.keys
      : [randomBytes(32).toString(), randomBytes(64).toString()];
    const app = FindMyWay({
      ignoreDuplicateSlashes: props.ignoreDuplicateSlashes ?? true,
      ignoreTrailingSlash: props.ignoreTrailingSlash ?? true,
      maxParamLength: props.maxParamLength ?? +Infinity,
      allowUnsafeRegex: props.allowUnsafeRegex ?? true,
      caseSensitive: props.caseSensitive ?? true,
      // @ts-ignore
      defaultRoute: async (_, next: Next) => await next(),
    })
    koa.use(this.hooks.compose('prefix'));
    koa.use(app.routes());
    koa.use(this.hooks.compose('suffix'));
    const server = createServer(koa.callback());
    await new Promise<void>((resolve, reject) => {
      server.listen(props.port, (err?: any) => {
        if (err) return reject(err);
        resolve();
      })
    })
    this.koa = koa;
    this.app = app;
    this.server = server;
    this.keys = keys;
    this.port = props.port;
  }

  protected terminate() {
    if (this.server) {
      this.server.close();
      this.koa = undefined;
      this.app = undefined;
      this.server = undefined;
      this.keys = undefined;
      this.port = undefined;
    }
  }

  public async bind<T extends INewAble<Controller>>(url: string, controller: T): Promise<void | (() => void)> {
    const defaultSuffix = process.env.IOCORE_HTTP_CONFIGS.defaultSuffix || '/index';
    url = url.startsWith('/') ? url : '/' + url;
    if (url.endsWith('/index')) {
      url = url.substring(0, url.length - defaultSuffix.length);
    }
    if (!url) url = '/';
    const wrap = await Component.preload(controller);
    if (wrap.meta.clazz.has(HttpDeprecatedNameSpace)) {
      if (wrap.meta.clazz.get(HttpDeprecatedNameSpace)) return;
    }
    if (!wrap.meta.clazz.has(HttpMethodNameSpace)) {
      throw new Error('Controller miss HttpMethod');
    }

    const methods: HTTPMethod[] = wrap.meta.clazz.get(HttpMethodNameSpace);
    const middlewares = await getMiddlewares(wrap);
    const transformer = transformInComingMetadata(wrap);

    const callbacks: (() => unknown)[] = [];
    for (let i = 0; i < methods.length; i++) {
      const method = methods[i];
      this.app.on(method, url, ...middlewares, async (ctx, next) => {
        const target = await Component.create(controller);
        await transformer(ctx, target);
        const res = target.response(next);
        if (res !== undefined) {
          ctx.body = res;
        }
      })
      callbacks.push(() => this.app.off(method, url));
    }
    return () => {
      for (let i = 0; i < callbacks.length; i++) {
        const callback = callbacks[i];
        callback();
      }
    }
  }
}