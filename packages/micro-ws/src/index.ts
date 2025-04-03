import { WebSocketServer, ServerOptions, WebSocket } from 'ws';
import { Channel } from './channel';

enum CONNECT_STATUS {
  DEFINED,
  CONNECTING,
}

export {
  ServerOptions,
}

export class MicroWebSocket {
  public readonly server: WebSocketServer;
  public readonly functions = new Map<string, Function>();
  private readonly channels = new Map<string, Channel>();
  private readonly connectings = new Map<string, {
    status: CONNECT_STATUS,
    pools: Set<{
      resolve: Function,
      reject: Function,
    }>
  }>();

  constructor(options: ServerOptions) {
    this.server = new WebSocketServer(options);
    this.server.on('connection', (socket, request) => {
      const ip = request.socket.remoteAddress;
      const port = request.socket.remotePort;
      const key = ip + ':' + port;
      if (!this.channels.has(key)) {
        this.createChannel(key, socket);
      }
    })
  }

  private createChannel(host: string, socket: WebSocket) {
    const channel = new Channel(host, socket, this);
    this.channels.set(host, channel);
    socket.on('close', () => {
      this.channels.delete(host);
    })
    return channel;
  }

  private connect(host: string) {
    return new Promise<Channel>((resolve, reject) => {
      const ws = new WebSocket('ws://' + host);
      const errorHander = (e: any) => {
        ws.off('error', errorHander);
        ws.off('open', openHandler);
        reject(e);
      }
      const openHandler = () => {
        ws.off('error', errorHander);
        ws.off('open', openHandler);
        resolve(this.createChannel(host, ws));
      }
      ws.on('open', openHandler);
      ws.on('error', errorHander);
    })
  }

  public use(host: string): Promise<Channel> {
    if (this.channels.has(host)) {
      return Promise.resolve<Channel>(this.channels.get(host));
    }

    if (!this.connectings.has(host)) {
      this.connectings.set(host, {
        status: CONNECT_STATUS.DEFINED,
        pools: new Set(),
      });
    }

    const target = this.connectings.get(host);

    switch (target.status) {
      case CONNECT_STATUS.DEFINED:
        target.status = CONNECT_STATUS.CONNECTING;
        return new Promise<Channel>((resolve, reject) => {
          this.connect(host).then(channel => {
            for (const pool of target.pools.values()) {
              pool.resolve(channel);
            }
            resolve(channel);
          }).catch(e => {
            for (const pool of target.pools.values()) {
              pool.reject(e);
            }
            reject(e);
          }).finally(() => this.connectings.delete(host));
        })
      case CONNECT_STATUS.CONNECTING:
        return new Promise<Channel>((resolve, reject) => {
          target.pools.add({ resolve, reject });
        })
    }
  }
}

export default MicroWebSocket;