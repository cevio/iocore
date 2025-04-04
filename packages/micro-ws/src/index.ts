import { WebSocketServer, ServerOptions, WebSocket } from 'ws';
import { Channel } from './channel';
import { EventEmitter } from 'node:events';
import { Exception } from '@iocore/demodulator';

enum CONNECT_STATUS {
  DEFINED,
  CONNECTING,
}
export { Channel } from './channel';
export {
  ServerOptions,
  Exception,
}

type IFunction<T = any, P extends any[] = any> = (channel: Channel, ...args: P) => T

export class MicroWebSocket extends EventEmitter {
  public readonly server: WebSocketServer;
  public readonly functions = new Map<string, IFunction>();
  public readonly channels = new Map<string, Channel>();
  private readonly connectings = new Map<string, {
    status: CONNECT_STATUS,
    pools: Set<{
      resolve: Function,
      reject: Function,
    }>
  }>();

  constructor(options: ServerOptions) {
    super();
    this.server = new WebSocketServer(options);
    this.server.on('connection', (socket, request) => {
      const forwardedFor = request.headers['x-forwarded-for'];
      let ip = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : (forwardedFor || '').split(',')[0].trim();
      if (!ip) {
        ip = request.headers['x-real-ip'] as string || '';
      }
      if (!ip) {
        const socketIp = request.socket.remoteAddress || 'unknown';
        const sp = socketIp.split(':');
        ip = sp[sp.length - 1];
      }

      const clientPortHeader = request.headers['x-client-port'];
      const clientPort = clientPortHeader
        ? parseInt(clientPortHeader as string, 10)
        : request.socket.remotePort; // 回退到代理连接的端口

      const key = ip + ':' + clientPort;
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
      this.emit('disconnect', channel);
    })
    this.emit('connect', channel);
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

  public bind<T = any, P extends any[] = []>(key: string, callback: IFunction<T, P>) {
    if (this.functions.has(key)) {
      throw new Error('方法[' + key + ']已存在');
    }
    this.functions.set(key, callback);
    return this;
  }

  public close() {
    this.server.close();
  }
}

export default MicroWebSocket;