import { Component } from "./component";

let NativeApplicationTerminaters: (() => unknown | Promise<unknown>)[] = [];

export abstract class Application extends Component {
  protected abstract initialize(): unknown | Promise<unknown>;
  public abstract terminate(): unknown | Promise<unknown>;

  static readonly Server: ClassDecorator = (target) => {
    Application.Singleton(target);
    Application.Injectable<Application>(async component => {
      await Promise.resolve(component.initialize());
      NativeApplicationTerminaters.push(component.terminate);
    })(target);
  }

  static async terminate() {
    for (let i = 0; i < NativeApplicationTerminaters.length; i++) {
      await Promise.resolve(NativeApplicationTerminaters[i]());
    }
    NativeApplicationTerminaters.length = 0;
    NativeApplicationTerminaters = [];
  }
}