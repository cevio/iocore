import { Wrap } from "./wrap";

export class Context<T> {
  public value: T;
  public callbacks: (() => unknown | Promise<unknown>)[] = [];
  constructor(private readonly wrap: Wrap<T>) { }
  public clear() {
    this.value = null;
    this.callbacks = [];
  }
}