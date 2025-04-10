import Logger from "@iocore/logger";
import { Channel, MicroWebSocket, Exception } from "@iocore/micro-ws";
import { Application, INewAble, Component } from "@iocore/component";
import { Service } from "./service";
import { detect } from 'detect-port';
import { operation } from 'retry';
import { Controller, ControllerRequest, ControllerResponse } from "./controller";

export type IOCORE_MICRO_WEBSOCKET_AGENT_CONFIGS = {
  registry: string,
  namespace: string,
  port?: number,
}

export {
  Service,
  Controller,
  Exception,
  ControllerRequest,
  ControllerResponse,
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
    const fetcher = registry.fetch('ws', 'online', [this.props.namespace]);
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
    const oper = operation({
      retries: +Infinity,
      maxRetryTime: 10 * 60 * 1000,
    });
    oper.attempt(i => {
      this.logger.debug('[' + i + ']', 'reconnect to registry:', this.props.registry);
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
    const { response } = registry.fetch('ws', 'where', [namespace]);
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

  public async createFetcher<R = any>(protocol: string, url: string, props: any[] = [], timeout?: number) {
    const uri = new URL(protocol + '://' + url);
    const namespace = uri.host;
    const router = uri.pathname;
    const channel = await this.where(namespace);
    const { response } = channel.fetch(protocol, router, props, timeout);
    return await response<R>();
  }

  public fetch<R = any>(url: string, props: any[] = [], timeout?: number) {
    return this.createFetcher<R>('ws', url, props, timeout);
  }

  public wsBinding<T extends Service>(url: string, clazz: INewAble<T>) {
    url = url.startsWith('/') ? url : '/' + url;
    this.server.bind('ws', url, async (channel, ...props: any[]) => {
      const target = await Component.create(clazz);
      Object.defineProperty(target, 'channel', { value: channel });
      Object.defineProperty(target, 'agent', { value: this });
      return await Promise.resolve(target.exec(...props));
    })
  }

  public httpBinding<B, T extends Controller<B>>(url: string, clazz: INewAble<T>) {
    url = url.startsWith('/') ? url : '/' + url;
    this.server.bind('http', url, async (channel, request: ControllerRequest) => {
      const target = await Component.create(clazz);
      Object.defineProperty(target, 'channel', { value: channel });
      Object.defineProperty(target, 'agent', { value: this });
      Object.defineProperty(target, 'headers', { value: request.headers });
      Object.defineProperty(target, 'query', { value: request.query });
      Object.defineProperty(target, 'params', { value: request.params });
      Object.defineProperty(target, 'cookie', { value: request.cookie });
      Object.defineProperty(target, 'body', { value: request.body });
      return await Promise.resolve(target.response());
    })
  }
}

export default MicroWebSocketAgent;