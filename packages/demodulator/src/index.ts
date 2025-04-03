import { AbortException, Exception, TimeoutException } from "./exception";

export enum DEMODULATOR_MODE {
  REQUEST,
  RESPONSE,
  ABORT,
}

export interface IDemodulatorMessage<T = any> {
  id: number,
  mode: DEMODULATOR_MODE,
  twoway: boolean,
  data?: T
}

export interface IDemodulatorMessageResponse<T = any> {
  status: string | number,
  data: T,
  message: string,
}

export abstract class Demodulator {
  private id = 0;

  private readonly aborts = new Map<number, (reason?: any) => void>();
  private readonly stacks = new Map<number, {
    resolve: (value?: any) => void,
    reject: (reason?: any) => void
  }>();

  protected abstract post<T = any>(data: IDemodulatorMessage<T>): void;
  protected abstract exec(data: any): any;

  // 创建安全的自增 ID
  private createId() {
    let id = this.id++;
    if (this.id >= Number.MAX_SAFE_INTEGER) {
      id = this.id = 0;
    }
    return id;
  }

  private createPostData<T = any>(mode: DEMODULATOR_MODE, data?: T) {
    const id = this.createId();
    const state: IDemodulatorMessage<T> = {
      id, twoway: true, data, mode,
    }
    if (mode === DEMODULATOR_MODE.ABORT) {
      state.twoway = false;
    }
    return state;
  }

  protected send<T = any>(data: T, timeout = 30000) {
    const controller = new AbortController();
    const state = this.createPostData(DEMODULATOR_MODE.REQUEST, data);
    this.post(state);
    return {
      abort: () => controller.abort(),
      response: <U = any>() => new Promise<U>((resolve, reject) => {
        // 清理 stacks
        const clear = () => {
          if (this.stacks.has(state.id)) {
            this.stacks.delete(state.id);
          }
        }

        const clean = () => {
          clearTimeout(timer);
          controller.signal.removeEventListener('abort', aborthandler);
          clear();
        }

        // Abort 处理函数
        const aborthandler = () => {
          clearTimeout(timer);
          this.post(this.createPostData(DEMODULATOR_MODE.ABORT, state.id));
          clear();
          reject(new AbortException());
        }

        // 成功处理
        const _resolve = (data?: U) => {
          clean();
          resolve(data);
        }

        // 失败处理
        const _reject = (e: any) => {
          clean();
          reject(e);
        }

        const timer = setTimeout(() => {
          if (!controller.signal.aborted) {
            controller.abort();
          } else {
            _reject(new TimeoutException());
          }
        }, timeout);

        controller.signal.addEventListener('abort', aborthandler);

        this.stacks.set(state.id, {
          resolve: _resolve,
          reject: _reject,
        });
      })
    }
  }

  private onRequest<T = any>(msg: IDemodulatorMessage<T>) {
    Promise.race([
      Promise.resolve(this.exec(msg.data)),
      new Promise((_, reject) => this.aborts.set(msg.id, reject)),
    ]).then(value => {
      if (msg.twoway) {
        this.post({
          id: msg.id,
          mode: DEMODULATOR_MODE.RESPONSE,
          twoway: false,
          data: {
            status: 200,
            data: value,
          }
        })
      }
    }).catch(e => {
      if (e instanceof AbortException) return;
      if (msg.twoway) {
        const code = e instanceof Exception ? e.status : 500;
        this.post({
          id: msg.id,
          mode: DEMODULATOR_MODE.RESPONSE,
          twoway: false,
          data: {
            status: code,
            data: null,
            message: e.message,
          }
        })
      }
    }).finally(() => {
      if (this.aborts.has(msg.id)) {
        this.aborts.delete(msg.id);
      }
    });
  }

  private onResponse<T = any>(msg: IDemodulatorMessage<IDemodulatorMessageResponse<T>>) {
    const id = msg.id;
    const res = msg.data;
    if (this.stacks.has(id)) {
      const { resolve, reject } = this.stacks.get(id);
      if (res.status !== 200) {
        reject(new Exception(res.status, res.message));
      } else {
        resolve(res.data);
      }
    }
  }

  public receive(msg: IDemodulatorMessage) {
    switch (msg.mode) {
      case DEMODULATOR_MODE.REQUEST:
        this.onRequest(msg);
        break;
      case DEMODULATOR_MODE.RESPONSE:
        this.onResponse(msg);
        break;
      case DEMODULATOR_MODE.ABORT:
        const id: number = msg.data;
        if (this.aborts.has(id)) {
          const reject = this.aborts.get(id);
          reject(new AbortException());
          break;
        }
    }
  }
}