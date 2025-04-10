import Component, { Application, INewAble, Meta } from "@iocore/component";
import Logger from "@iocore/logger";
import { Channel, MicroWebSocket, Exception } from "@iocore/micro-ws";
import { MicroWSMiddlewareNameSpace, Service } from "./service";
import { detect } from 'detect-port';
import { operation } from 'retry';
import { Middleware } from "./middleware";
import { compose, Next } from "./compose";

export type IOCORE_MICRO_WEBSOCKET_AGENT_CONFIGS = {
  registry: string,
  namespace: string,
  port?: number,
}

export {
  Service,
  Exception,
  Next,
  Middleware
}

@Application.Server
export class MicroWebSocketAgent extends Application {
  public readonly props: IOCORE_MICRO_WEBSOCKET_AGENT_CONFIGS;
  private server: MicroWebSocket;
  private readonly connections = new Map<string, Channel>();

  @Application.Inject(Logger)
  private readonly logger: Logger;

  get registry() {
    if (this.server.channels.has(this.props.registry)) {
      return this.server.channels.get(this.props.registry);
    }
  }

  constructor() {
    super();
    if (!process.env.IOCORE_MICRO_WEBSOCKET_AGENT_CONFIGS) {
      throw new Error('`@iocore/micro-ws-agent` miss configs: IOCORE_MICRO_WEBSOCKET_AGENT_CONFIGS');
    }
    this.props = JSON.parse(process.env.IOCORE_MICRO_WEBSOCKET_AGENT_CONFIGS);
  }

  private async connectRegistry() {
    const registry = await this.server.use(this.props.registry);
    const fetcher = registry.fetch('online', this.props.namespace);
    await fetcher.response();
  }

  public async initialize() {
    const port = await detect(this.props.port);
    this.server = new MicroWebSocket({ port });
    this.props.port = port;
    this.server.on('connect', (channel: Channel) => {
      this.logger.info('+', channel.host);
    })
    this.server.on('disconnect', (channel: Channel) => {
      this.logger.info('-', channel.host);
      if (channel.host === this.props.registry) {
        this.reconnectRegistry();
      } else {
        for (const [key, _channel] of this.connections.entries()) {
          if (_channel === channel) {
            this.connections.delete(key);
            break;
          }
        }
      }
    })
    await this.connectRegistry();
    this.logger.info(`[${this.props.namespace}] start on port: ${this.props.port}`);
  }

  private reconnectRegistry() {
    const oper = operation();
    oper.attempt(i => {
      this.logger.debug('-', 'reconnect to registry:', i);
      this.connectRegistry().catch(e => {
        if (oper.retry(e)) {
          return;
        }
        this.logger.error(oper.mainError());
      })
    });
  }

  public async where(namespace: string) {
    if (this.connections.has(namespace)) {
      return this.connections.get(namespace);
    }
    const registry = this.registry;
    if (!registry) {
      throw new Exception(414, 'Cannot find the registry, may be it disconnect');
    }
    const { response } = registry.fetch('where', namespace);
    const host = await response<string>();
    if (!host) {
      throw new Exception(
        404,
        'Cannot find the namepsace of ' + namespace + ' from registry'
      );
    }
    const channel = await this.server.use(host);
    this.connections.set(namespace, channel);
    return channel;
  }

  public terminate() {
    this.server.removeAllListeners('disconnect');
    if (this.registry) {
      this.registry.disconnect();
    }
    this.server.close();
  }

  public async fetch<T extends string, R = any>(options: {
    url: `${T}://${string}`,
    props: any[],
    timeout?: number,
    extra?: {
      [K in T]: any
    } & Record<string, any>
  }) {
    const uri = new URL(options.url);
    const namespace = uri.host;
    const router = uri.pathname;
    const channel = await this.where(namespace);
    const { response } = channel.fetch(router, {
      props: options.props,
      extra: options.extra || {},
      protocol: uri.protocol,
    }, options.timeout);
    return await response<R>();
  }

  public bind<P extends any[], R, T extends Service<P, R>>(url: string, clazz: INewAble<T>) {
    url = url.startsWith('/') ? url : '/' + url;
    const meta = Meta.get(clazz);
    const middlewares: INewAble<Middleware>[] = meta.clazz.get(MicroWSMiddlewareNameSpace);
    this.server.bind(url, async (channel, data: { props: P, extra: any, protocol: string }) => {
      let value: R;
      const mixin = this.mixin(channel, data.protocol, data.extra);
      const _middlewares = (middlewares || []).map(middleware => {
        return async (next: Next) => {
          const target = mixin(await Component.create(middleware));
          await target.use(next);
        }
      });
      _middlewares.push(async next => {
        const target = mixin(await Component.create(clazz));
        value = await target.exec(...data.props);
        await next();
      });
      const composed = compose(_middlewares);
      await composed();
      return value;
    })
  }

  private mixin(channel: Channel, protocol: string, extra: any) {
    return <T>(target: T) => {
      Object.defineProperties(target, {
        channel: {
          get: () => channel,
        },
        agent: {
          get: () => this,
        },
        protocol: {
          get: () => protocol.endsWith(':')
            ? protocol.substring(0, protocol.length - 1)
            : protocol,
        },
        extra: {
          get: () => extra,
        }
      })
      return target;
    }
  }
}

export default MicroWebSocketAgent;