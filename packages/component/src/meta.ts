import 'reflect-metadata';

export class Meta {
  public readonly clazz = new Map<string | symbol, any>();
  public readonly properties = new Map<string | symbol, Map<string | symbol, any>>();
  public readonly methods = new Map<string | symbol, Map<string | symbol, any>>();
  public readonly paramters = new Map<string | symbol, Map<string | symbol, any>[]>();

  static readonly namespace = Symbol('#namespace:meta');
  static get(target: Function): Meta {
    if (!Reflect.hasMetadata(Meta.namespace, target)) {
      Reflect.defineMetadata(Meta.namespace, new Meta(), target);
    }
    return Reflect.getMetadata(Meta.namespace, target);
  }

  static createClassDecorator<T = any>(id: string | symbol, callback: (opts: {
    target: Function,
    value: T,
  }) => T): ClassDecorator {
    return (target) => {
      const meta = Meta.get(target);
      const value = callback({ target, value: meta.clazz.get(id) });
      meta.clazz.set(id, value);
    }
  }

  static createPropertyDecorator<T = any>(id: string | symbol, callback: (opts: {
    target: Object,
    property: string | symbol,
    value: T,
  }) => T): PropertyDecorator {
    return (target, property) => {
      const obj = target.constructor;
      const meta = Meta.get(obj);
      if (!meta.properties.has(property)) {
        meta.properties.set(property, new Map());
      }
      const current = meta.properties.get(property);
      const value = current.get(id);
      const res = callback({ target, property, value });
      current.set(id, res);
    }
  }

  static createMethodDecorator<T>(id: string | symbol, callback: (opts: {
    target: Object,
    property: string | symbol,
    value: T,
    descriptor: TypedPropertyDescriptor<any>
  }) => T): MethodDecorator {
    return (target, property, descriptor) => {
      const obj = target.constructor;
      const meta = Meta.get(obj);
      if (!meta.methods.has(property)) {
        meta.methods.set(property, new Map());
      }
      const current = meta.methods.get(property);
      const value = current.get(id);
      const res = callback({ target, property, value, descriptor });
      current.set(id, res);
    }
  }

  static createParamterDecorator<T>(id: string | symbol, callback: (opts: {
    target: Object,
    property: string | symbol,
    value: T,
    index: number,
  }) => T): ParameterDecorator {
    return (target, property, index) => {
      const obj = target.constructor;
      const meta = Meta.get(obj);
      if (!meta.paramters.has(property)) {
        meta.paramters.set(property, []);
      }
      const current = meta.paramters.get(property);
      const chunk = current[index];
      if (!chunk) {
        current[index] = new Map();
      }
      const value = current[index].get(id);
      const res = callback({ target, property, value, index });
      current[index].set(id, res);
    }
  }
}