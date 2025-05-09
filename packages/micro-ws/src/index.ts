import { WebSocketServer, ServerOptions, WebSocket } from 'ws';
import { Channel } from './channel';
import { EventEmitter } from 'node:events';
import { Exception } from '@iocore/demodulator';
import { networkInterfaces } from 'os';

enum CONNECT_STATUS {
  DEFINED,
  CONNECTING,
}
export { Channel } from './channel';
export {
  ServerOptions,
  Exception,
}

type IFunction<T = any> = (channel: Channel, ...args: any[]) => T

export class MicroWebSocket extends EventEmitter {
  public readonly server: WebSocketServer;
  //                                  协议         识别码    函数
  public readonly functions = new Map<string, Map<string, IFunction>>();
  public readonly channels = new Map<string, Channel>();
  private readonly host = getInternalIp();
  private readonly port: number;
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
    this.port = options.port;
    this.server.on('connection', (socket, request) => {
      const url = request.url;
      const sp = url.split('/');
      const host = sp[1];
      const port = sp[2];
      if (!host || !port) return;
      const key = host + ':' + port;
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
      const ws = new WebSocket('ws://' + host + '/' + this.host + '/' + this.port);
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

  public bind<T = any>(protocol: string, key: string, callback: IFunction<T>) {
    if (!this.functions.has(protocol)) {
      this.functions.set(protocol, new Map());
    }
    const _protocol = this.functions.get(protocol);
    if (_protocol.has(key)) {
      throw new Error('method [' + key + '] already exits on protocol ' + protocol);
    }
    _protocol.set(key, callback);
    return this;
  }

  public close() {
    this.server.close();
  }
}

export default MicroWebSocket;

function getInternalIp() {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}