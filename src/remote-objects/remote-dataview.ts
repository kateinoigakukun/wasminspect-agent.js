import { RemoteMemoryBuffer } from "./remote-memory-buffer";

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
      buffer: remoteBuffer,
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

