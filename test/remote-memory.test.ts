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
    const constructors = [Uint8Array, Uint16Array, Uint32Array]
    test.each(constructors)("%p.length", (constructor) => {
        const byteLength = 16;
        const WrappedArray = wrapTypedArray(constructor);
        const client = new MockRpcClient();
        const buffer = new RemoteMemoryBuffer("dummy", 0, byteLength, client);
        const target = new WrappedArray(buffer);
        const original = new constructor(new Uint8Array(byteLength).buffer);
        client.memory = Uint8Array.from(Array(byteLength).fill(0));

        expect(target.length).toBe(original.length);
    })

    test.each(constructors)("%p subscript get 1 byte number", (constructor) => {
        const byteLength = 16;
        const WrappedArray = wrapTypedArray(constructor);
        const client = new MockRpcClient();
        const buffer = new RemoteMemoryBuffer("dummy", 0, byteLength, client);
        const target = new WrappedArray(buffer);
        const originalBuffer = new Uint8Array(byteLength);
        const original = new constructor(originalBuffer.buffer);
        client.memory = Uint8Array.from(Array(byteLength).fill(0));

        expect(target[0]).toBe(original[0]);
        client.memory[0] = 1;
        originalBuffer[0] = 1;
        expect(target[0]).toBe(originalBuffer[0]);
        expect(target[byteLength]).toBe(undefined);

        expect(target[-1]).toBe(originalBuffer[-1]);
    })

    it("subscript get multi-bytes number", () => {
        const byteLength = 16;
        const WrappedArray = wrapTypedArray(Uint16Array);
        const client = new MockRpcClient();
        const buffer = new RemoteMemoryBuffer("dummy", 0, byteLength, client);
        const target = new WrappedArray(buffer);

        const memoryBuffer = new ArrayBuffer(byteLength);
        client.memory = new Uint8Array(memoryBuffer);

        (new Uint16Array(memoryBuffer))[0] = 0xFF00;
        expect(client.memory[0]).toBe(0x00);
        expect(client.memory[1]).toBe(0xFF);
        expect(target[0]).toBe(0xFF00);
    })

    test.each(constructors)("%p subscript set 1 byte number", (constructor) => {
        const byteLength = 16;
        const WrappedArray = wrapTypedArray(constructor);
        const client = new MockRpcClient();
        const buffer = new RemoteMemoryBuffer("dummy", 0, byteLength, client);
        const target = new WrappedArray(buffer);
        const originalBuffer = new Uint8Array(byteLength);
        const original = new constructor(originalBuffer.buffer);
        client.memory = Uint8Array.from(Array(16).fill(0));

        target[0] = 1;
        original[0] = 1;
        expect(client.memory[0]).toBe(originalBuffer[0]);

        target[byteLength/constructor.BYTES_PER_ELEMENT] = 1;
        original[byteLength/constructor.BYTES_PER_ELEMENT] = 1;
        expect(target[byteLength]).toBe(undefined);

        target[-1] = 1;
        original[-1] = 1;
        expect(client.memory).toEqual(originalBuffer);
    })

    it("subscript set multi-bytes number", () => {
        const byteLength = 16;
        const WrappedArray = wrapTypedArray(Uint16Array);
        const client = new MockRpcClient();
        const buffer = new RemoteMemoryBuffer("dummy", 0, 16, client);
        const target = new WrappedArray(buffer);

        const memoryBuffer = new ArrayBuffer(byteLength);
        client.memory = new Uint8Array(memoryBuffer);

        target[0] = 0xFF00;
        expect(client.memory[0]).toBe(0x00);
        expect(client.memory[1]).toBe(0xFF);
        expect(target[0]).toBe(0xFF00);
        target[byteLength] = 1;
        expect(client.memory[byteLength/2]).toBe(0x00);
        expect(client.memory[byteLength/2]).toBe(0x00);
    })

    test.each(constructors)("%p.slice", (constructor) => {
        const byteLength = 16;
        const WrappedArray = wrapTypedArray(constructor);
        const client = new MockRpcClient();
        const buffer = new RemoteMemoryBuffer("dummy", 0, byteLength, client);
        const target = new WrappedArray(buffer);
        const originalBuffer = new Uint8Array(byteLength);
        const original = new constructor(originalBuffer.buffer);

        client.memory = Uint8Array.from(Array(16).fill(0));
        for (let i = 0; i < 16; i++) {
            client.memory[i] = i;
            originalBuffer[i] = i;
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
        expect(targetSlice1).toEqual(originalSlice1);

        // Negative start
        const targetSlice2 = target.slice(-1);
        const originalSlice2 = original.slice(-1);
        expect(targetSlice2).toEqual(originalSlice2);

        // Negative end
        const targetSlice3 = target.slice(0, -1);
        const originalSlice3 = original.slice(0, -1);
        expect(targetSlice3).toEqual(originalSlice3);
    })
})
