import { Component, NativeComponents } from "./component";
import { Context } from "./context";
import { Wrap } from "./wrap";

const NativeApplications: Wrap[] = [];
const ApplicationServer = async (ctx: Context<Application>) => {
  await Promise.resolve(ctx.value.initialize());
  ctx.callbacks.push(() => ctx.value.terminate());
  NativeApplications.push(ctx.wrap);
}

export abstract class Application extends Component {
  public abstract initialize(): unknown | Promise<unknown>;
  public abstract terminate(): unknown | Promise<unknown>;

  static readonly Server: ClassDecorator = target => {
    Application.Singleton(target);
    Application.Injectable<Application>(ApplicationServer)(target);
  }

  static async destroy<T extends Application>(clazz: { new(...args: any[]): T }) {
    if (!NativeComponents.has(clazz)) {
      throw new Error('Application is not exits');
    }
    await NativeComponents.get(clazz).stop();
  }

  static async terminate() {
    let i = NativeApplications.length;
    while (i--) {
      await NativeApplications[i].stop();
    }
  }
}