import { WorkerClient } from "./worker-client"

export class RemoteMemoryBuffer implements ArrayBuffer {
    [Symbol.toStringTag]: string;
    byteLength: number;
    private name: string;
    private offset: number;
    private worker: WorkerClient;

    constructor(name: string, offset: number, length: number, worker: WorkerClient) {
        this[Symbol.toStringTag] = "RemoteMemoryBuffer";
        this.name = name;
        this.offset = offset;
        this.byteLength = length;
        this.worker = worker;
    }

    slice(start: number, end: number): RemoteMemoryBuffer {
        return new RemoteMemoryBuffer(this.name, start, end - start, this.worker);
    }
}
