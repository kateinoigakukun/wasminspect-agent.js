import { TextRequest, TextResponse, InitResponse, WasmExport } from "./socket-rpc"
import { WorkerRequest, SocketResponse } from "./worker-rpc";
import { WorkerClient } from "./worker-client";
import { Config, defaultConfig } from "./config";
import { RemoteMemoryBuffer } from "./remote-memory";
import createSocketWorker from "./worker-constructor"
import { RpcClient, RpcClientImpl } from "./rpc-client";
import { wrapTypedArray } from "./remote-memory"

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

    export function init() {
        Uint8Array = wrapTypedArray(Uint8Array);
        Uint16Array = wrapTypedArray(Uint16Array);
    }

    function _createExportObject(e: WasmExport, module: Module): WebAssembly.ExportValue | undefined {
        switch (e.type) {
            case "Memory": {
                const buffer = new RemoteMemoryBuffer(e.name, 0, e.memorySize, module.rpc);
                return new Memory(buffer);
            }
            case "Function": {
                return (...args: any[]) => {
                    module.rpc.textRequest({ type: "CallExported", name: e.name, args: args }, true);
                    const result = module.rpc.blockingTextResponse("CallResult");
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
        rpc: RpcClient
        init: InitResponse;
        constructor(init: InitResponse, rpc: RpcClient) {
            this.init = init;
            this.rpc = rpc;
        }
    }

    export async function compile(bytes: BufferSource): Promise<Module> {
        let uint8Buffer: Uint8Array;
        if (bytes instanceof ArrayBuffer) {
            uint8Buffer = new Uint8Array(bytes);
        } else {
            uint8Buffer = new Uint8Array(bytes.buffer);
        }
        const worker = new WorkerClient(configuration, createSocketWorker);
        const rpc = new RpcClientImpl(worker);
        await worker.postRequest({
            type: "Configure",
            inner: configuration,
        });
        await worker.receive("OnSocketOpen");
        rpc.binaryRequest(uint8Buffer);
        const init = await rpc.textResponse("Init");
        return new Module(init, rpc);
    }

    // export function instantiate(bytes: BufferSource, importObject?: WebAssembly.Imports): Promise<WebAssembly.WebAssemblyInstantiatedSource> {
    // }
}
