import Component from "@iocore/component";
import MicroWebSocketAgent from "./index";
import { Channel } from "@iocore/micro-ws";

export abstract class Service<T extends any[] = [], R = any> extends Component {
  protected readonly channel: Channel;
  protected readonly agent: MicroWebSocketAgent;
  public abstract exec(...args: T): R | Promise<R>;
  public connect(host: string) {
    return this.channel.server.use(host);
  }
  public use(namespace: string) {
    return this.agent.where(namespace);
  }
}