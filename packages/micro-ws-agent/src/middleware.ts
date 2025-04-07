import Component from "@iocore/component";
import MicroWebSocketAgent from "./index";
import { Channel } from "@iocore/micro-ws";
import { Next } from "./compose";

export abstract class Middleware<P = any> extends Component {
  protected readonly channel: Channel;
  protected readonly agent: MicroWebSocketAgent;
  protected readonly extra: any;
  protected readonly protocol: string;

  get state() {
    return this.extra[this.protocol] as P;
  }

  public abstract use(next: Next): Promise<unknown>;

  public fetch<T extends string, R = any>(options: {
    url: `${T}://${string}`,
    props: any[],
    timeout?: number,
    extra?: {
      [K in T]: any
    } & Record<string, any>
  }) {
    return this.agent.fetch<T, R>(options);
  }
}