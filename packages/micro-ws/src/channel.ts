import { Demodulator, Exception, IDemodulatorMessage } from "@iocore/demodulator";
import { WebSocket } from "ws";
import { MicroWebSocket } from "./index";

interface ChannelPostData {
  cmd: string,
  props: any[],
  protocol: string,
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

  public fetch(protocol: string, cmd: string, props: any[], timeout?: number) {
    return this.send<ChannelPostData>({ cmd, props, protocol }, timeout);
  }

  protected post<T = any>(data: IDemodulatorMessage<T>): void {
    this.socket.send(JSON.stringify(data));
  }

  protected exec(data: ChannelPostData) {
    if (this.server.functions.has(data.protocol)) {
      const protocol = this.server.functions.get(data.protocol);
      if (protocol.has(data.cmd)) {
        const fn = protocol.get(data.cmd);
        return fn(this, ...data.props);
      }
    }
    throw new Exception(104, `Cannot find the url '${data.protocol}:/${data.cmd}'`);
  }

  public disconnect() {
    if (this.socket.CLOSING || this.socket.CLOSED) return;
    this.socket.close();
  }
}