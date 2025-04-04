import { Boot } from '@iocore/boot';
import { Channel, MicroWebSocket } from '@iocore/micro-ws';

export default class extends Boot {
  private readonly server: MicroWebSocket;
  private readonly namespaces = new Map<string, string>();
  private readonly port: number;
  constructor() {
    super();
    this.port = Number(process.env.IOCORE_MICRO_WEBSOCKET_REGISTRY_PORT || 8427);
    this.server = new MicroWebSocket({ port: this.port });
    this.server.on('disconnect', (channel: Channel) => {
      for (const [key, value] of this.namespaces.entries()) {
        if (channel.host === value) {
          this.namespaces.delete(key);
          break;
        }
      }
    })
  }

  private online() {
    this.server.bind('online', (channel, namespace: string) => {
      this.namespaces.set(namespace, channel.host);
      this.logger.info('+', namespace, channel.host);
    })
  }

  private where() {
    this.server.bind('where', (_, namespace: string) => {
      if (this.namespaces.has(namespace)) {
        return this.namespaces.get(namespace);
      }
    })
  }

  protected initialize() {
    this.online();
    this.where();
    this.logger.info('[Micro WS Registry] start on port:' + this.port);
  }

  protected terminate() {
    this.server.close();
  }
}