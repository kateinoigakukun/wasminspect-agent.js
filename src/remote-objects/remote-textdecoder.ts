import { RemoteMemoryBuffer } from "./remote-memory-buffer";

export function wrapTextDecoder(constructor: any) {
  const constructProxy = (args: any[]) => {
    const proxy = new Proxy(new constructor(args), instanceHandler);
    return proxy;
  };
  const instanceHandler: ProxyHandler<TextDecoder> = {
    getPrototypeOf() {
      return constructor.prototype;
    },
    get(target, prop, receiver) {
      if (prop === "decode") {
        return (buffer: any) => {
          if (buffer instanceof RemoteMemoryBuffer) {
            const bytes = new Uint8Array(buffer.slice());
            return target.decode(bytes);
          } else if (buffer.remoteBuffer) {
            const bytes = new Uint8Array(buffer.remoteBuffer.slice());
            return target.decode(bytes);
          }
          return target.decode(buffer);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  };
  const constructorHandler: ProxyHandler<any> = {
    construct(target, args) {
      return constructProxy(args);
    },
  };
  return new Proxy(constructor, constructorHandler);
}
