import { RemoteMemoryBuffer } from "./remote-memory-buffer";

function _optionMap<T, U>(
  v: T | undefined,
  transform: (v: T) => U
): U | undefined {
  if (v) {
    return transform(v);
  }
  return undefined;
}

export function wrapTypedArray<
  Constructor extends
    | Uint8ArrayConstructor
    | Uint16ArrayConstructor
    | Uint32ArrayConstructor
    | Int8ArrayConstructor
    | Int16ArrayConstructor
    | Int32ArrayConstructor
    | Float32ArrayConstructor
    | Float64ArrayConstructor
>(constructor: Constructor) {
  const constructProxy = (remoteBuffer: RemoteMemoryBuffer) => {
    const proxy = new Proxy({ remoteBuffer }, instanceHandler);
    return proxy;
  };
  const instanceHandler: ProxyHandler<{ remoteBuffer: RemoteMemoryBuffer }> = {
    getPrototypeOf() {
      return constructor.prototype;
    },
    get(target, prop, receiver) {
      if (typeof prop !== "string") {
        return Reflect.get(target, prop, receiver);
      }
      const propAsNumber = Number(prop);
      if (!isNaN(propAsNumber)) {
        const start = propAsNumber * constructor.BYTES_PER_ELEMENT;
        const end = start + constructor.BYTES_PER_ELEMENT;
        const bytes = target.remoteBuffer.sliceWithCanonicalIndex(start, end);
        if (!bytes) {
          return undefined;
        }
        const view = new constructor(bytes);
        return view[0];
      }
      switch (prop) {
        case "length":
          return target.remoteBuffer.byteLength / constructor.BYTES_PER_ELEMENT;
        case "buffer":
          return target.remoteBuffer;
        case "subarray": {
          return (start?: number, end?: number) => {
            const remoteBuffer = target.remoteBuffer.subarray(
              _optionMap(start, (v) => v * constructor.BYTES_PER_ELEMENT),
              _optionMap(end, (v) => v * constructor.BYTES_PER_ELEMENT)
            );
            return constructProxy(remoteBuffer);
          };
        }
        case "slice": {
          return (start?: number, end?: number) => {
            const remoteBuffer = target.remoteBuffer.slice(
              _optionMap(start, (v) => v * constructor.BYTES_PER_ELEMENT),
              _optionMap(end, (v) => v * constructor.BYTES_PER_ELEMENT)
            );
            return new constructor(remoteBuffer);
          };
        }
        case "set": {
          return (arrayLike: ArrayLike<number>, offset?: number) => {
            const byteOffset =
              _optionMap(offset, (v) => v * constructor.BYTES_PER_ELEMENT) ?? 0;
            const byteLength = arrayLike.length * constructor.BYTES_PER_ELEMENT;
            const bytes = new Uint8Array(byteLength);
            const tmpView = new constructor(bytes.buffer);
            tmpView.set(arrayLike);
            target.remoteBuffer.setWithCanonicalIndex(
              byteOffset,
              Array.from(bytes)
            );
          };
        }
      }
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      if (typeof prop !== "string") {
        return Reflect.set(target, prop, value, receiver);
      }
      const propAsNumber = Number(prop);
      if (!isNaN(propAsNumber)) {
        const tmp = new Uint8Array(constructor.BYTES_PER_ELEMENT);
        const view = new constructor(tmp.buffer);
        view[0] = value;
        target.remoteBuffer.setWithCanonicalIndex(
          propAsNumber * constructor.BYTES_PER_ELEMENT,
          Array.from(tmp)
        );
        return true;
      }
      return Reflect.set(target, prop, value, receiver);
    },
  };

  const constructorHandler: ProxyHandler<Constructor> = {
    construct(target, args) {
      if (args[0] instanceof RemoteMemoryBuffer) {
        const remoteBuffer = args[0];
        if (args.length > 1) {
          const start = args[1] * constructor.BYTES_PER_ELEMENT;
          const end =
            args.length > 2
              ? start + args[2] * constructor.BYTES_PER_ELEMENT
              : undefined;
          const subarray = remoteBuffer.subarray(start, end);
          return constructProxy(subarray);
        }
        return constructProxy(remoteBuffer);
      }
      const newThis = Reflect.construct(target, args);
      return newThis;
    },
  };
  return new Proxy(constructor, constructorHandler);
}
