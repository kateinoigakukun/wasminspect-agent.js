import { TextRequest, SocketResponse, TextResponse, InitResponse, WasmExport } from "./socket-rpc"
import { WorkerRequest } from "./worker-rpc";
import { WorkerClient } from "./worker-client";
import { Config, defaultConfig } from "./config";
import { RemoteMemoryBuffer } from "./remote-memory";

export namespace WasmInspect {

    export let configuration: Config = defaultConfig();

    export class Memory implements WebAssembly.Memory {
        buffer: RemoteMemoryBuffer;
        constructor(buffer: RemoteMemoryBuffer) {
            this.buffer = buffer;
        }
        grow(delta: number): number {
            return 0;
        }
    }

    function _createExportObject(e: WasmExport, module: Module): WebAssembly.ExportValue | undefined {
        switch (e.type) {
            case "Memory": {
                const buffer = new RemoteMemoryBuffer(e.name, 0, e.memorySize, module.worker);
                return new Memory(buffer);
            }
            case "Function": {
                return (...args: any[]) => {
                    module.worker.postRequest(_createTextRequest({ type: "CallExported", name: e.name, args: args }), true);
                    const response = module.worker.blockingReceive("SocketResponse");
                    const result = _castTextResponse(response.inner, "CallResult");
                    return result.values[0];
                };
            }
            case "Global":
            case "Table": {
                console.warn(`[wasminspect-web] Exporting ${e.type} is not supported yet`)
                break;
            }
        }
    }

    export class Instance implements WebAssembly.Instance {
        exports: WebAssembly.Exports;
        constructor(module: Module, importObjects?: WebAssembly.Imports) {
            this.exports = {};
            for (const e of module.init.exports) {
                let exportVal = _createExportObject(e, module);
                if (exportVal) {
                    this.exports[e.name] = exportVal;
                }
            }
        }
    }

    export class Module implements WebAssembly.Module {
        worker: WorkerClient
        init: InitResponse;
        constructor(init: InitResponse, worker: WorkerClient) {
            this.init = init;
            this.worker = worker
        }
    }

    type _TextResponseKind = TextResponse["type"]
    type _SelectTextResponse<T extends _TextResponseKind> = Extract<TextResponse, { type: T }>;
    function _castTextResponse<T extends _TextResponseKind>(response: SocketResponse, type: T): _SelectTextResponse<T> {
        if (response.type == "TextResponse") {
            if (response.body.type == type) {
                return response.body as _SelectTextResponse<T>;
            } else {
                throw new Error(`[wasminspect-web] Unexpected response: ${response}. expected: ${type}`);
            }
        } else {
            throw new Error(`[wasminspect-web] Unexpected response: ${response}. expected: TextResponse`);
        }
    }

    function _createTextRequest(body: TextRequest): WorkerRequest {
        return {
            type: "SocketRequest",
            inner: {
                type: "TextRequest",
                body
            }
        }
    }

    function _createBinaryRequest(body: Uint8Array): WorkerRequest {
        return {
            type: "SocketRequest",
            inner: {
                type: "BinaryRequest",
                body
            }
        }
    }

    export async function compile(bytes: BufferSource): Promise<Module> {
        let uint8Buffer: Uint8Array;
        if (bytes instanceof ArrayBuffer) {
            uint8Buffer = new Uint8Array(bytes);
        } else {
            uint8Buffer = new Uint8Array(bytes.buffer);
        }
        const worker = new WorkerClient(configuration);
        await worker.postRequest({
            type: "Configure",
            inner: configuration,
        });
        await worker.receive("OnSocketOpen");
        worker.postRequest(_createBinaryRequest(uint8Buffer));
        const response = await worker.receive("SocketResponse");
        const init = _castTextResponse(response.inner, "Init");
        return new Module(init, worker);
    }

    // export function instantiate(bytes: BufferSource, importObject?: WebAssembly.Imports): Promise<WebAssembly.WebAssemblyInstantiatedSource> {
    // }
}
