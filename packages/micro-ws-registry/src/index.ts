import { Boot } from '@iocore/boot';
import { Channel, Exception, MicroWebSocket } from '@iocore/micro-ws';
import { Application } from '@iocore/component';

@Application.Server
export default class extends Boot {
  private readonly server: MicroWebSocket;
  private readonly namespaces = new Map<string, string>();
  private readonly port: number;
  constructor() {
    super();
    this.port = Number(process.env.IOCORE_MICRO_WEBSOCKET_REGISTRY_PORT || 8427);
    this.server = new MicroWebSocket({ port: this.port });
    this.server.on('connect', (channel: Channel) => {
      this.logger.info('+', channel.host);
    })
    this.server.on('disconnect', (channel: Channel) => {
      this.logger.info('-', channel.host);
      for (const [key, value] of this.namespaces.entries()) {
        if (channel.host === value) {
          this.namespaces.delete(key);
          break;
        }
      }
    })
  }

  public namespaceToArray() {
    return Array.from(this.namespaces.entries()).map(([key, value]) => ({
      name: key,
      host: value,
    }))
  }

  private online() {
    this.server.bind('ws', 'online', (channel, namespace: string) => {
      this.namespaces.set(namespace, channel.host);
      this.logger.info('+', namespace, channel.host);
    })
  }

  private where() {
    this.server.bind('ws', 'where', (_, namespace: string) => {
      if (this.namespaces.has(namespace)) {
        return this.namespaces.get(namespace);
      }
    })
  }

  public async createFetcher<R = any>(protocol: string, url: string, props: any[] = [], timeout?: number) {
    const uri = new URL(protocol + '://' + url);
    const namespace = uri.host;
    const router = uri.pathname;
    if (!this.namespaces.has(namespace)) {
      throw new Exception(
        404,
        'Cannot find the namepsace of ' + namespace + ' from registry'
      );
    }
    const channel = await this.server.use(this.namespaces.get(namespace));
    const { response } = channel.fetch(protocol, router, props, timeout);
    return await response<R>();
  }

  public initialize() {
    this.online();
    this.where();
    this.logger.info('[Micro WS Registry] start on port:' + this.port);
  }

  public terminate() {
    this.server.close();
  }
}