import { RpcClient } from "./rpc-client";

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

    slice(start: number, end: number): RemoteMemoryBuffer {
        return new RemoteMemoryBuffer(this.name, start, end - start, this.rpc);
    }
}
