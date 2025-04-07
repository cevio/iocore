import Koa from 'koa';
import FindMyWay, { Instance } from './find-my-way';
import Component, { Application, INewAble } from "@iocore/component";
import { randomBytes } from 'node:crypto';
import { Config, HTTPVersion, HTTPMethod } from 'find-my-way';
import { createServer, Server } from 'node:http';
import { HttpMiddlewareHooks } from "./hooks";
import { Controller, HttpDeprecatedNameSpace, HttpMethodNameSpace } from "./controller";
import { Router } from './router';
import { Middleware } from './middleware';

export type IOCORE_HTTP_CONFIGS = {
  port: number,
  keys?: string[],
  defaultSuffix?: string,
} & Omit<Config<HTTPVersion.V1>, 'defaultRoute'>

@Application.Server
export class Http extends Application {
  public koa: Koa;
  public app: Instance;
  public server: Server;
  public readonly props: IOCORE_HTTP_CONFIGS;

  @Application.Inject(HttpMiddlewareHooks)
  public readonly hooks: HttpMiddlewareHooks;

  constructor() {
    super();
    if (!process.env.IOCORE_HTTP_CONFIGS) {
      throw new Error('`@iocore/http` miss configs: IOCORE_HTTP_CONFIGS');
    }
    this.props = JSON.parse(process.env.IOCORE_HTTP_CONFIGS);
    if (!this.props.keys) {
      this.props.keys = [randomBytes(32).toString(), randomBytes(64).toString()];
    }
  }

  public async initialize() {
    const koa = new Koa();
    koa.keys = this.props.keys;
    const app = FindMyWay({
      ignoreDuplicateSlashes: this.props.ignoreDuplicateSlashes ?? true,
      ignoreTrailingSlash: this.props.ignoreTrailingSlash ?? true,
      maxParamLength: this.props.maxParamLength ?? +Infinity,
      allowUnsafeRegex: this.props.allowUnsafeRegex ?? true,
      caseSensitive: this.props.caseSensitive ?? true,
      // @ts-ignore
      defaultRoute: async (_, next: Next) => await next(),
    })
    koa.use(this.hooks.compose('prefix'));
    koa.use(app.routes());
    koa.use(this.hooks.compose('suffix'));
    const server = createServer(koa.callback());
    await new Promise<void>((resolve, reject) => {
      server.listen(this.props.port, (err?: any) => {
        if (err) return reject(err);
        resolve();
      })
    })
    this.koa = koa;
    this.app = app;
    this.server = server;
  }

  public terminate() {
    if (this.server) {
      this.server.close();
      this.koa = undefined;
      this.app = undefined;
      this.server = undefined;
    }
  }

  public async bind<T extends INewAble<Controller>>(url: string, controller: T): Promise<void | (() => void)> {
    const defaultSuffix = this.props.defaultSuffix || '/index';
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
    const middlewares = await Middleware.get(wrap);
    const transformer = Router.getInComing(wrap);

    const callbacks: (() => unknown)[] = [];
    for (let i = 0; i < methods.length; i++) {
      const method = methods[i];
      this.app.on(method, url, ...middlewares, async (ctx, next) => {
        const target = await Component.create(controller);
        await transformer(ctx, target);
        const res = await Promise.resolve(target.response(next));
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