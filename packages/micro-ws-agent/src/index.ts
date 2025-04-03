import { Application } from "@iocore/component";
import { Channel, MicroWebSocket } from "@iocore/micro-ws";

@Application.Server
export class MicroWebSocketAgent extends Application {
  private readonly defaultRegistryHost = '127.0.0.1:8427';
  private readonly namespace = 'test';
  private readonly server: MicroWebSocket;
  private registry: Channel;
  constructor() {
    super();
    this.server = new MicroWebSocket({ port: 8324 });
    this.server.on('disconnect', (channel: Channel) => {
      if (this.registry === channel) {
        this.connectRegistry();
      }
    })
  }

  private async connectRegistry() {
    const registry = await this.server.use(this.defaultRegistryHost);
    const { response } = registry.fetch('online', [this.namespace]);
    await response();
    this.registry = registry;
  }

  protected async initialize() {
    await this.connectRegistry();
  }

  protected terminate() {
    if (this.registry) {
      this.registry.disconnect();
    }
    this.server.close();
  }
}