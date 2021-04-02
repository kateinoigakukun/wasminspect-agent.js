import { RemoteMemoryBuffer, wrapTypedArray } from "../dist/remote-memory"
import { TextRequest, TextResponse } from "../src/socket-rpc";
import { RpcClient, _TextResponseKind, _SelectTextResponse } from "../src/rpc-client";

class MockRpcClient implements RpcClient {
    private lastRequest: TextRequest | undefined
    memory: Uint8Array = new Uint8Array();

    textRequest(body: TextRequest, isBlocking: boolean): void {
        this.lastRequest = body
    }
    binaryRequest(body: Uint8Array, isBlocking: boolean): void {
        throw new Error("unimplemented");
    }
    textResponse<T extends _TextResponseKind>(type: T): Promise<_SelectTextResponse<T>> {
        throw new Error("unimplemented");
    }
    blockingTextResponse<T extends _TextResponseKind>(type: T): _SelectTextResponse<T> {
        if (!this.lastRequest) {
            throw new Error("no request")
        }
        switch (this.lastRequest.type) {
            case "LoadMemory": {
                const start = this.lastRequest.offset;
                const end = start + this.lastRequest.length;
                return {
                    type: "LoadMemoryResult",
                    bytes: Array.from(this.memory.slice(start, end))
                } as _SelectTextResponse<T>;
            }
            case "StoreMemory": {
                const start = this.lastRequest.offset;
                const length = this.lastRequest.bytes.length
                for (let delta = 0; delta < length; delta++) {
                    this.memory[start + delta] = this.lastRequest.bytes[delta];
                }
                return {
                    type: "StoreMemoryResult",
                } as _SelectTextResponse<T>;
            }
            default: {
                throw new Error("unimplemented");
            }
        }
    }
}

describe("remote-memory", () => {
    it("length", () => {
        for (const constructor of [Uint8Array, Uint16Array, Uint32Array]) {
            const WrappedArray = wrapTypedArray(constructor);
            const client = new MockRpcClient();
            const buffer = new RemoteMemoryBuffer("dummy", 0, 4, client);
            const target = new WrappedArray(buffer);
            const original = new constructor(new Uint8Array(4).buffer);
            client.memory = Uint8Array.from(Array(4).fill(0));
            expect(target.length).toBe(original.length);
        }
    })

    it("subscript get 1 byte number", () => {
        for (const original of [Uint8Array, Uint16Array, Uint32Array]) {
            const WrappedArray = wrapTypedArray(original);
            const client = new MockRpcClient();
            const buffer = new RemoteMemoryBuffer("dummy", 0, 4, client);
            const obj = new WrappedArray(buffer);
            client.memory = Uint8Array.from(Array(4).fill(0));
            expect(obj[0]).toBe(0);
            client.memory[0] = 1;
            expect(obj[0]).toBe(1);
            // expect(obj.length).toBe(1);
        }
    })

    it("subscript get multi-bytes number", () => {
        const WrappedArray = wrapTypedArray(Uint16Array);
        const client = new MockRpcClient();
        const buffer = new RemoteMemoryBuffer("dummy", 0, 16, client);
        const obj = new WrappedArray(buffer);

        const memoryBuffer = new ArrayBuffer(16);
        client.memory = new Uint8Array(memoryBuffer);

        const multiByteView = new Uint16Array(memoryBuffer);
        multiByteView[0] = 0xFF00;
        expect(client.memory[0]).toBe(0x00);
        expect(client.memory[1]).toBe(0xFF);
        expect(obj[0]).toBe(0xFF00);
    })

    it("subscript set 1 byte number", () => {
        for (const original of [Uint8Array, Uint16Array, Uint32Array]) {
            const WrappedArray = wrapTypedArray(original);
            const client = new MockRpcClient();
            const buffer = new RemoteMemoryBuffer("dummy", 0, 16, client);
            const obj = new WrappedArray(buffer);
            client.memory = Uint8Array.from(Array(16).fill(0));

            obj[0] = 1;
            expect(client.memory[0]).toBe(1);

            obj[16] = 1;
            expect(obj[16]).toBe(undefined);
        }
    })

    it("subscript set multi-bytes number", () => {
        const WrappedArray = wrapTypedArray(Uint16Array);
        const client = new MockRpcClient();
        const buffer = new RemoteMemoryBuffer("dummy", 0, 16, client);
        const obj = new WrappedArray(buffer);

        const memoryBuffer = new ArrayBuffer(16);
        client.memory = new Uint8Array(memoryBuffer);

        obj[0] = 0xFF00;
        expect(client.memory[0]).toBe(0x00);
        expect(client.memory[1]).toBe(0xFF);
        expect(obj[0]).toBe(0xFF00);
    })

    it("slice", () => {
        const WrappedArray = wrapTypedArray(Uint8Array);
        const client = new MockRpcClient();
        const buffer = new RemoteMemoryBuffer("dummy", 0, 16, client);
        const target = new WrappedArray(buffer);
        const original = new Uint8Array(16);

        client.memory = Uint8Array.from(Array(16).fill(0));
        for (let i = 0; i < 16; i++) {
            client.memory[i] = i;
            original[i] = i;
        }

        const targetSlice0 = target.slice(1, 4);
        const originalSlice0 = original.slice(1, 4);
        for (let i = 0; i < 5; i++) {
            expect(targetSlice0[i]).toBe(originalSlice0[i]);
        }

        // Check that write operation to sliced array should not be affected
        // original array.
        targetSlice0[0] = 2;
        originalSlice0[0] = 2;
        expect(target[1]).toBe(original[1]);

        // Without end
        const targetSlice1 = target.slice(1);
        const originalSlice1 = original.slice(1);
        expect(targetSlice1[0]).toBe(originalSlice1[0]);
    })
})
