import { RpcClient } from "./rpc-client";

export function NumberFromLittleEndian(bytes: number[]): number {
    let value: number = 0;
    for (let i = 0; i < bytes.length; i++) {
        value += bytes[i] << (8 * i);
    }
    return value;
}

export function LittleEndianFromNumber(value: number, length: number): number[] {
    const bytes = Array(length);
    for (let i = 0; i < length; i++) {
        const shift = 8 * i;
        const mask = 0xFF << shift;
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

    subarray(start: number, end: number, BYTES_PER_ELEMENT: number): RemoteMemoryBuffer {
        return new RemoteMemoryBuffer(this.name, this.offset + start, end - start, this.rpc);
    }

    slice(start: number, end?: number): ArrayBuffer {
        let _end = end || this.byteLength;
        if (this.byteLength < _end) {
            return new ArrayBuffer(0);
        }
        if (start < 0) {
            start = this.byteLength + start;
        }
        if (_end < 0) {
            _end = this.byteLength + _end;
        }
        this.rpc.textRequest({
            type: "LoadMemory",
            offset: this.offset + start,
            length: (_end - start)
        }, true)
        const result = this.rpc.blockingTextResponse("LoadMemoryResult");
        const bytes = new Uint8Array(result.bytes);
        return bytes.buffer;
    }

    subscriptGetter(index: number, BYTES_PER_ELEMENT: number): number | undefined {
        if (index < 0 || this.byteLength <= index * BYTES_PER_ELEMENT) {
            return undefined
        }
        this.rpc.textRequest({
            type: "LoadMemory",
            offset: this.offset + index * BYTES_PER_ELEMENT,
            length: BYTES_PER_ELEMENT
        }, true)
        const result = this.rpc.blockingTextResponse("LoadMemoryResult");
        return NumberFromLittleEndian(result.bytes);
    }

    subscriptSetter(index: number, BYTES_PER_ELEMENT: number, value: number): boolean {
        if (index < 0 || this.byteLength <= index) {
            return true;
        }
        this.rpc.textRequest({
            type: "StoreMemory",
            offset: this.offset + index * BYTES_PER_ELEMENT,
            bytes: LittleEndianFromNumber(value, BYTES_PER_ELEMENT),
        }, true)
        this.rpc.blockingTextResponse("StoreMemoryResult");
        return true;
    }
}

export function wrapTypedArray<
    Constructor extends
    Uint8ArrayConstructor |
    Uint16ArrayConstructor |
    Uint32ArrayConstructor |
    Int8ArrayConstructor |
    Int16ArrayConstructor |
    Int32ArrayConstructor
>(constructor: Constructor) {
    const constructProxy = (remoteBuffer: RemoteMemoryBuffer) => {
        const proxy = new Proxy({ remoteBuffer }, instanceHandler);
        return proxy;
    }
    const instanceHandler: ProxyHandler<{ remoteBuffer: RemoteMemoryBuffer }> = {
        get(target, prop, receiver) {
            if (typeof prop !== "string") {
                return Reflect.get(target, prop, receiver);
            }
            const propAsNumber = Number(prop);
            if (!isNaN(propAsNumber)) {
                return target.remoteBuffer.subscriptGetter(propAsNumber, constructor.BYTES_PER_ELEMENT);
            }
            switch (prop) {
                case "length":
                    return target.remoteBuffer.byteLength / constructor.BYTES_PER_ELEMENT;
                case "slice": {
                    return (start: number, end?: number) => {
                        const remoteBuffer = target.remoteBuffer.slice(
                            start * constructor.BYTES_PER_ELEMENT,
                            (() => {
                                if (end) {
                                    return end * constructor.BYTES_PER_ELEMENT;
                                }
                                return undefined;
                            })()
                        );
                        return new constructor(remoteBuffer);
                    }
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
                return target.remoteBuffer.subscriptSetter(propAsNumber, constructor.BYTES_PER_ELEMENT, value);
            }
            return Reflect.set(target, prop, value, receiver);
        },
    }

    const constructorHandler: ProxyHandler<Constructor> = {
        construct(target, args) {
            if (args[0] instanceof RemoteMemoryBuffer) {
                return constructProxy(args[0]);
            }
            const newThis = Reflect.construct(target, args);
            return newThis;
        },
    }
    return new Proxy(constructor, constructorHandler);
}
