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

  /**
   * 创建一个类装饰器工厂。
   *
   * @template T - 元数据值的类型。
   * @param {string | symbol} id - 用于存储和检索元数据的唯一标识符。
   * @param {function(opts: { target: Function, value: T }): T} callback - 处理元数据的回调函数。
   *   - `target`: 被装饰的类构造函数。
   *   - `value`: 当前与此 `id` 关联的元数据值（如果存在）。
   * @returns {ClassDecorator} 返回一个类装饰器函数。
   * @example
   * ```typescript
   * // 定义一个用于存储类信息的装饰器
   * const ClassInfo = Meta.createClassDecorator<string>('class:info', ({ value, target }) => {
   *   return `Class Name: ${target.name}, Previous Info: ${value || 'None'}`;
   * });
   *
   * @ClassInfo
   * class MyClass {}
   *
   * // 获取元数据
   * const meta = Meta.get(MyClass);
   * console.log(meta.clazz.get('class:info')); // 输出: "Class Name: MyClass, Previous Info: None"
   * ```
   */
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

  /**
   * 创建一个属性装饰器工厂。
   *
   * @template T - 元数据值的类型。
   * @param {string | symbol} id - 用于存储和检索元数据的唯一标识符。
   * @param {function(opts: { target: Object, property: string | symbol, value: T }): T} callback - 处理元数据的回调函数。
   *   - `target`: 类的原型对象。
   *   - `property`: 被装饰的属性名称。
   *   - `value`: 当前与此 `id` 和 `property` 关联的元数据值（如果存在）。
   * @returns {PropertyDecorator} 返回一个属性装饰器函数。
   * @example
   * ```typescript
   * // 定义一个用于标记属性是否可注入的装饰器
   * const Injectable = Meta.createPropertyDecorator<boolean>('prop:injectable', () => true);
   *
   * class MyService {
   *   @Injectable
   *   dependency: string;
   * }
   *
   * // 获取元数据
   * const meta = Meta.get(MyService);
   * console.log(meta.properties.get('dependency')?.get('prop:injectable')); // 输出: true
   * ```
   */
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

  /**
   * 创建一个方法装饰器工厂。
   *
   * @template T - 元数据值的类型。
   * @param {string | symbol} id - 用于存储和检索元数据的唯一标识符。
   * @param {function(opts: { target: Object, property: string | symbol, value: T, descriptor: TypedPropertyDescriptor<any> }): T} callback - 处理元数据的回调函数。
   *   - `target`: 类的原型对象。
   *   - `property`: 被装饰的方法名称。
   *   - `value`: 当前与此 `id` 和 `property` 关联的元数据值（如果存在）。
   *   - `descriptor`: 方法的属性描述符。
   * @returns {MethodDecorator} 返回一个方法装饰器函数。
   * @example
   * ```typescript
   * // 定义一个记录方法调用的装饰器
   * const LogCall = Meta.createMethodDecorator<boolean>('method:log', ({ property }) => {
   *   console.log(`Method ${String(property)} will be called.`);
   *   return true;
   * });
   *
   * class Calculator {
   *   @LogCall
   *   add(a: number, b: number) {
   *     return a + b;
   *   }
   * }
   *
   * // 获取元数据
   * const meta = Meta.get(Calculator);
   * console.log(meta.methods.get('add')?.get('method:log')); // 输出: true (并且在调用 add 方法时会打印日志)
   * const calc = new Calculator();
   * calc.add(1, 2); // 输出: "Method add will be called."
   * ```
   */
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

  /**
   * 创建一个参数装饰器工厂。
   *
   * @template T - 元数据值的类型。
   * @param {string | symbol} id - 用于存储和检索元数据的唯一标识符。
   * @param {function(opts: { target: Object, property: string | symbol, value: T, index: number }): T} callback - 处理元数据的回调函数。
   *   - `target`: 类的原型对象。
   *   - `property`: 方法的名称（注意：对于构造函数参数，这里是 `undefined`）。
   *   - `value`: 当前与此 `id`、`property` 和 `index` 关联的元数据值（如果存在）。
   *   - `index`: 参数在参数列表中的索引。
   * @returns {ParameterDecorator} 返回一个参数装饰器函数。
   * @example
   * ```typescript
   * // 定义一个记录参数类型的装饰器
   * const ParamType = Meta.createParameterDecorator<string>('param:type', ({ index }) => {
   *   return `Type for parameter at index ${index}`; // 在实际应用中，可能需要 reflect-metadata 来获取实际类型
   * });
   *
   * class Greeter {
   *   greet(name: string, @ParamType prefix: string) {
   *     console.log(`${prefix} ${name}`);
   *   }
   * }
   *
   * // 获取元数据
   * const meta = Meta.get(Greeter);
   * const paramMeta = meta.paramters.get('greet')?.[1]; // 获取 greet 方法的第二个参数 (index 1) 的元数据 Map
   * console.log(paramMeta?.get('param:type')); // 输出: "Type for parameter at index 1"
   * ```
   */
  static createParameterDecorator<T>(id: string | symbol, callback: (opts: {
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