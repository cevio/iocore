import Component, { Application, INewAble } from "@iocore/component";
import Logger from "@iocore/logger";
import { Channel, MicroWebSocket, Exception } from "@iocore/micro-ws";
import { Service } from "./service";
import { detect } from 'detect-port';

export type IOCORE_MICRO_WEBSOCKET_AGENT_CONFIGS = {
  registry: string,
  namespace: string,
  port?: number,
}

export {
  Service,
  Exception,
}

@Application.Server
export class MicroWebSocketAgent extends Application {
  private readonly props: IOCORE_MICRO_WEBSOCKET_AGENT_CONFIGS;
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
    const fetcher = registry.fetch('online', [this.props.namespace]);
    await fetcher.response();
  }

  protected async initialize() {
    const port = await detect(this.props.port);
    this.server = new MicroWebSocket({ port });
    this.props.port = port;
    this.server.on('disconnect', (channel: Channel) => {
      if (channel.host === this.props.registry) {
        this.connectRegistry()
          .catch(e => this.logger.error(e));
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

  public async where(namespace: string) {
    if (this.connections.has(namespace)) {
      return this.connections.get(namespace);
    }
    const { response } = this.registry.fetch('where', [namespace]);
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

  protected terminate() {
    this.server.removeAllListeners('disconnect');
    if (this.registry) {
      this.registry.disconnect();
    }
    this.server.close();
  }

  public bind<P extends any[], R, T extends Service<P, R>>(url: string, clazz: INewAble<T>) {
    url = url.startsWith('/') ? url : '/' + url;
    this.server.bind(url, async (channel, ...args: P) => {
      const target = await Component.create(clazz);
      Object.defineProperties(target, {
        channel: {
          get: () => channel,
        },
        agent: {
          get: () => this,
        },
      })
      return await target.exec(...args);
    })
  }
}

export default MicroWebSocketAgent;