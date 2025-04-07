import Component from "@iocore/component";
import MicroWebSocketAgent from "./index";
import { Channel, Exception } from "@iocore/micro-ws";

export abstract class Service<T extends any[] = [], R = any> extends Component {
  protected readonly channel: Channel;
  protected readonly agent: MicroWebSocketAgent;
  public abstract exec(...args: T): R | Promise<R>;

  public async fetch<R = any>(url: `ws://${string}`, args: any[] = [], timeout?: number) {
    const uri = new URL(url);
    if (uri.protocol !== 'ws:') {
      throw new Exception(461, 'protocol unaccept');
    }
    const namespace = uri.host;
    const router = uri.pathname;
    const channel = await this.agent.where(namespace);
    const { response } = channel.fetch(router, args, timeout);
    return await response<R>();
  }
}