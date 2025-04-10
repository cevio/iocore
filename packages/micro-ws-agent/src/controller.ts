import { BaseContext } from "./base";

export interface ControllerResponse<T = any> {
  body: T,
  headers?: Record<string, string | string[]>,
  cookie?: Record<string, string | string[]>,
  redirect?: string,
}

export interface ControllerRequest<T = any> {
  headers: Record<string, string | string[]>
  query: Record<string, string | string[]>,
  params: Record<string, string>,
  cookie: Record<string, string>,
  body: T,
}

export abstract class Controller<Body = any> extends BaseContext {
  protected readonly headers: ControllerRequest<Body>['headers'];
  protected readonly query: ControllerRequest<Body>['query'];
  protected readonly params: ControllerRequest<Body>['params'];
  protected readonly cookie: ControllerRequest<Body>['cookie'];
  protected readonly body: ControllerRequest<Body>['body'];

  public abstract response(): ControllerResponse | Promise<ControllerResponse>;
}