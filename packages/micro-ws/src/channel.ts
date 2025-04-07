import { Demodulator, IDemodulatorMessage } from "@iocore/demodulator";
import { WebSocket } from "ws";
import { MicroWebSocket } from "./index";

interface ChannelPostData {
  cmd: string,
  props: any,
}

export class Channel extends Demodulator {
  constructor(
    public readonly host: string,
    public readonly socket: WebSocket,
    public readonly server: MicroWebSocket,
  ) {
    super();
    socket.on('message', msg => {
      let text: string;
      if (Buffer.isBuffer(msg)) {
        text = msg.toString();
      } else if (typeof msg === 'string') {
        text = msg;
      }
      if (text) {
        let data: IDemodulatorMessage;
        try { data = JSON.parse(text); } catch (e) { }
        if (data) {
          this.receive(data);
        }
      }
    })
  }

  public fetch(cmd: string, props: any, timeout?: number) {
    return this.send<ChannelPostData>({ cmd, props }, timeout);
  }

  protected post<T = any>(data: IDemodulatorMessage<T>): void {
    this.socket.send(JSON.stringify(data));
  }

  protected exec(data: ChannelPostData) {
    if (this.server.functions.has(data.cmd)) {
      const fn = this.server.functions.get(data.cmd);
      return fn(this, data.props);
    }
  }

  public disconnect() {
    if (this.socket.CLOSING || this.socket.CLOSED) return;
    this.socket.close();
  }
}