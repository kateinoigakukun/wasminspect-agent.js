import { RpcClient } from "./rpc-client";

export function NumberFromLittleEndian(bytes: number[]): number {
  let value: number = 0;
  for (let i = 0; i < bytes.length; i++) {
    value += bytes[i] << (8 * i);
  }
  return value;
}

export function LittleEndianFromNumber(
  value: number,
  length: number
): number[] {
  const bytes = Array(length);
  for (let i = 0; i < length; i++) {
    const shift = 8 * i;
    const mask = 0xff << shift;
    bytes[i] = (value & mask) >> shift;
  }
  return bytes;
}

export class RemoteMemoryBuffer implements ArrayBuffer {
  [Symbol.toStringTag]: string;
  byteLength: number;
  private name: string;
  private offset: number;
  private rpc: RpcClient;

  constructor(name: string, offset: number, length: number, rpc: RpcClient) {
    this[Symbol.toStringTag] = "RemoteMemoryBuffer";
    this.name = name;
    this.offset = offset;
    this.byteLength = length;
    this.rpc = rpc;
  }

  private _resolveSubrange(
    start?: number,
    end?: number
  ): { begin: number; end: number } | undefined {
    let _start = start || 0;
    let _end = end || this.byteLength;
    if (this.byteLength < _end) {
      return undefined;
    }
    if (_start < 0) {
      _start = this.byteLength + _start;
    }
    if (_end < 0) {
      _end = this.byteLength + _end;
    }
    return { begin: _start, end: _end };
  }

  subarray(start?: number, end?: number): RemoteMemoryBuffer {
    const range = this._resolveSubrange(start, end);
    if (!range) {
      return new RemoteMemoryBuffer(this.name, 0, 0, this.rpc);
    }
    return new RemoteMemoryBuffer(
      this.name,
      this.offset + range.begin,
      range.end - range.begin,
      this.rpc
    );
  }

  slice(start?: number, end?: number): ArrayBuffer {
    const range = this._resolveSubrange(start, end);
    if (!range) {
      return new ArrayBuffer(0);
    }
    this.rpc.textRequest(
      {
        type: "LoadMemory",
        offset: this.offset + range.begin,
        length: range.end - range.begin,
      },
      true
    );
    const result = this.rpc.blockingTextResponse("LoadMemoryResult");
    const bytes = new Uint8Array(result.bytes);
    return bytes.buffer;
  }

  _validRange(start: number, end: number): boolean {
    return !(start < 0 || this.byteLength < end);
  }

  sliceWithCanonicalIndex(start: number, end: number): ArrayBuffer | undefined {
    if (!this._validRange(start, end)) {
      return undefined;
    }
    return this.slice(start, end);
  }

  set(offset: number, bytes: number[]): void {
    this.rpc.textRequest(
      {
        type: "StoreMemory",
        offset: this.offset + offset,
        bytes: bytes,
      },
      true
    );
    this.rpc.blockingTextResponse("StoreMemoryResult");
  }

  setWithCanonicalIndex(offset: number, bytes: number[]): boolean {
    if (!this._validRange(offset, offset + bytes.length)) {
      return false;
    }
    this.set(offset, bytes);
    return true;
  }
}

function _optionMap<T, U>(
  v: T | undefined,
  transform: (v: T) => U
): U | undefined {
  if (v) {
    return transform(v);
  }
  return undefined;
}

export function wrapDataView(constructor: DataViewConstructor) {
  const constructWrapper = (remoteBuffer: RemoteMemoryBuffer) => {
    const fixedNumberGetter = (
      byteOffset: number,
      buffer: RemoteMemoryBuffer,
      length: number,
      getter: (view: DataView, byteOffset: number) => number
    ) => {
      const bytes = buffer.sliceWithCanonicalIndex(
        byteOffset,
        byteOffset + length
      );
      if (!bytes) {
        throw new RangeError("Offset is outside the bounds of the DataView");
      }
      const view = new constructor(bytes);
      return getter(view, byteOffset);
    };
    const fixedNumberSetter = (
      byteOffset: number,
      buffer: RemoteMemoryBuffer,
      length: number,
      setter: (view: DataView) => void
    ) => {
      const tmp = new Uint8Array(length);
      const view = new constructor(tmp.buffer);
      setter(view);
      const bytes = Array.from(tmp);
      if (!buffer.setWithCanonicalIndex(byteOffset, bytes)) {
        throw new RangeError("Offset is outside the bounds of the DataView");
      }
    };
    return {
      remoteBuffer,
      getFloat32(byteOffset: number, littleEndian?: boolean): number {
        return fixedNumberGetter(byteOffset, this.remoteBuffer, 4, (v, o) => {
          return v.getFloat32(o, littleEndian);
        });
      },
      getFloat64(byteOffset: number, littleEndian?: boolean): number {
        return fixedNumberGetter(byteOffset, this.remoteBuffer, 8, (v, o) => {
          return v.getFloat64(o, littleEndian);
        });
      },
      getInt8(byteOffset: number): number {
        return fixedNumberGetter(byteOffset, this.remoteBuffer, 1, (v, o) => {
          return v.getInt8(o);
        });
      },
      getInt16(byteOffset: number, littleEndian?: boolean): number {
        return fixedNumberGetter(byteOffset, this.remoteBuffer, 2, (v, o) => {
          return v.getInt16(o, littleEndian);
        });
      },
      getInt32(byteOffset: number, littleEndian?: boolean): number {
        return fixedNumberGetter(byteOffset, this.remoteBuffer, 4, (v, o) => {
          return v.getInt32(o, littleEndian);
        });
      },
      getUint8(byteOffset: number): number {
        return fixedNumberGetter(byteOffset, this.remoteBuffer, 1, (v, o) => {
          return v.getUint8(o);
        });
      },
      getUint16(byteOffset: number, littleEndian?: boolean): number {
        return fixedNumberGetter(byteOffset, this.remoteBuffer, 2, (v, o) => {
          return v.getUint16(o, littleEndian);
        });
      },
      getUint32(byteOffset: number, littleEndian?: boolean): number {
        return fixedNumberGetter(byteOffset, this.remoteBuffer, 4, (v, o) => {
          return v.getUint32(o, littleEndian);
        });
      },
      setFloat32(
        byteOffset: number,
        value: number,
        littleEndian?: boolean
      ): void {
        return fixedNumberSetter(byteOffset, this.remoteBuffer, 4, (v) => {
          v.setFloat32(0, value, littleEndian);
        });
      },
      setFloat64(byteOffset: number, value: number, littleEndian?: boolean) {
        return fixedNumberSetter(byteOffset, this.remoteBuffer, 8, (v) => {
          return v.setFloat64(0, value, littleEndian);
        });
      },
      setInt8(byteOffset: number, value: number) {
        return fixedNumberSetter(byteOffset, this.remoteBuffer, 1, (v) => {
          return v.setInt8(0, value);
        });
      },
      setInt16(byteOffset: number, value: number, littleEndian?: boolean) {
        return fixedNumberSetter(byteOffset, this.remoteBuffer, 2, (v) => {
          return v.setInt16(0, value, littleEndian);
        });
      },
      setInt32(byteOffset: number, value: number, littleEndian?: boolean) {
        return fixedNumberSetter(byteOffset, this.remoteBuffer, 4, (v) => {
          return v.setInt32(0, value, littleEndian);
        });
      },
      setUint8(byteOffset: number, value: number) {
        return fixedNumberSetter(byteOffset, this.remoteBuffer, 1, (v) => {
          return v.setUint8(0, value);
        });
      },
      setUint16(byteOffset: number, value: number, littleEndian?: boolean) {
        return fixedNumberSetter(byteOffset, this.remoteBuffer, 2, (v) => {
          return v.setUint16(0, value, littleEndian);
        });
      },
      setUint32(byteOffset: number, value: number, littleEndian?: boolean) {
        return fixedNumberSetter(byteOffset, this.remoteBuffer, 4, (v) => {
          return v.setUint32(0, value, littleEndian);
        });
      },
    };
  };
  const constructorHandler: ProxyHandler<DataViewConstructor> = {
    construct(target, args) {
      if (args[0] instanceof RemoteMemoryBuffer) {
        return constructWrapper(args[0]);
      }
      const newThis = Reflect.construct(target, args);
      return newThis;
    },
  };
  return new Proxy(constructor, constructorHandler);
}

export function wrapTypedArray<
  Constructor extends
    | Uint8ArrayConstructor
    | Uint16ArrayConstructor
    | Uint32ArrayConstructor
    | Int8ArrayConstructor
    | Int16ArrayConstructor
    | Int32ArrayConstructor
>(constructor: Constructor) {
  const constructProxy = (remoteBuffer: RemoteMemoryBuffer) => {
    const proxy = new Proxy({ remoteBuffer }, instanceHandler);
    return proxy;
  };
  const instanceHandler: ProxyHandler<{ remoteBuffer: RemoteMemoryBuffer }> = {
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
      }
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      if (typeof prop !== "string") {
        return Reflect.set(target, prop, value, receiver);
      }
      const propAsNumber = Number(prop);
      if (!isNaN(propAsNumber)) {
        const bytes = LittleEndianFromNumber(
          value,
          constructor.BYTES_PER_ELEMENT
        );
        target.remoteBuffer.setWithCanonicalIndex(
          propAsNumber * constructor.BYTES_PER_ELEMENT,
          bytes
        );
        return true;
      }
      return Reflect.set(target, prop, value, receiver);
    },
  };

  const constructorHandler: ProxyHandler<Constructor> = {
    construct(target, args) {
      if (args[0] instanceof RemoteMemoryBuffer) {
        return constructProxy(args[0]);
      }
      const newThis = Reflect.construct(target, args);
      return newThis;
    },
  };
  return new Proxy(constructor, constructorHandler);
}
