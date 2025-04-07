import Component from "@iocore/component";
import MicroWebSocketAgent from "./index";
import { Channel, Exception } from "@iocore/micro-ws";

export abstract class Service<T extends any[] = [], R = any> extends Component {
  protected readonly channel: Channel;
  protected readonly agent: MicroWebSocketAgent;
  public abstract exec(...args: T): R | Promise<R>;

  public fetch<R = any>(url: `ws://${string}`, args: any[] = [], timeout?: number) {
    return this.agent.fetch<R>(url, args, timeout);
  }
}