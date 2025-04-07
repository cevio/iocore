import Component, { INewAble, Meta } from "@iocore/component";
import MicroWebSocketAgent from "./index";
import { Channel } from "@iocore/micro-ws";
import { Middleware } from "./middleware";

export const MicroWSMiddlewareNameSpace = Symbol('#Micro.ws.midddleware')

export abstract class Service<T extends any[] = [], R = any> extends Component {
  protected readonly channel: Channel;
  protected readonly agent: MicroWebSocketAgent;
  protected readonly protocol: string;
  protected readonly extra: any;

  public abstract exec(...args: T): R | Promise<R>;

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

  static Middleware(...args: INewAble<Middleware>[]) {
    return Meta.createClassDecorator<INewAble<Middleware>[]>(MicroWSMiddlewareNameSpace, ({ value }) => {
      const _value = value ?? [];
      for (let i = 0; i < args.length; i++) {
        if (!_value.includes(args[i])) {
          _value.push(args[i]);
        }
      }
      return _value;
    })
  }
}