import { BaseContext } from "./base";

export abstract class Service extends BaseContext {
  public abstract exec(...args: any[]): unknown | Promise<unknown>;
}