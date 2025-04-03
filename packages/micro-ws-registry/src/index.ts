import { Boot } from '@iocore/boot';
import { Channel, MicroWebSocket } from '@iocore/micro-ws';

export default class extends Boot {
  private readonly server: MicroWebSocket;
  private readonly namespaces = new Map<string, string>();
  constructor(port: number = 8427) {
    super();
    this.server = new MicroWebSocket({ port });
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
  }

  protected terminate() {
    this.server.close();
  }
}