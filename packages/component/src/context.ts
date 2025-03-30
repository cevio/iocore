import { EventEmitter } from "./events";
import { Wrap } from "./wrap";

export class Context<T> extends EventEmitter {
  public value: T;
  public callbacks: (() => unknown | Promise<unknown>)[] = [];
  constructor(public readonly wrap: Wrap<T>) {
    super();
  }
  public clear() {
    this.value = null;
    this.callbacks = [];
  }
}