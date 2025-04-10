import MicroWebSocketAgent from "./index";
import { Channel } from "@iocore/micro-ws";
import { Component } from "@iocore/component";

export class BaseContext extends Component {
  protected readonly channel: Channel;
  protected readonly agent: MicroWebSocketAgent;

  public fetch<R = any>(url: string, props?: any[], timeout?: number) {
    return this.agent.fetch<R>(url, props, timeout);
  }
}