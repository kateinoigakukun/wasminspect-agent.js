import { InitResponse, WasmExport } from "./socket-rpc";
import { WorkerClient } from "./worker-client";
import { Config, defaultConfig } from "./config";
import { RemoteMemoryBuffer } from "./remote-memory";
import createSocketWorker from "./worker-constructor";
import { RpcClient, RpcClientImpl } from "./rpc-client";
import { wrapTypedArray } from "./remote-memory";
import { WorkerHandle } from "./worker";

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

  export function init(globalContext: any) {
    globalContext.Uint8Array = wrapTypedArray(Uint8Array);
    globalContext.Uint16Array = wrapTypedArray(Uint16Array);
    globalContext.WebAssembly = WasmInspect;
  }
  export async function destroy(module: WebAssembly.Module) {
    if (!(module instanceof Module)) {
      console.log("[wasminspect-web] Destorying non-WasmInspect version module");
      return;
    }
    module.worker.postRequest({ type: "Terminate" });
    await module.worker.receive("Terminated");
    await module.worker.terminate();
  }

  function _createExportObject(
    e: WasmExport,
    module: Module
  ): WebAssembly.ExportValue | undefined {
    switch (e.type) {
      case "Memory": {
        const buffer = new RemoteMemoryBuffer(
          e.name,
          0,
          e.memorySize,
          module.rpc
        );
        return new Memory(buffer);
      }
      case "Function": {
        return (...args: any[]) => {
          module.rpc.textRequest(
            { type: "CallExported", name: e.name, args: args },
            true
          );
          const result = module.rpc.blockingTextResponse("CallResult");
          return result.values[0];
        };
      }
      case "Global":
      case "Table": {
        console.warn(
          `[wasminspect-web] Exporting ${e.type} is not supported yet`
        );
        break;
      }
    }
  }

  export class Instance implements WebAssembly.Instance {
    exports: WebAssembly.Exports;
    constructor(module: Module, importObjects?: WebAssembly.Imports) {
      this.exports = {};
      if (module.init.exports) {
        for (const e of module.init.exports) {
          let exportVal = _createExportObject(e, module);
          if (exportVal) {
            this.exports[e.name] = exportVal;
          }
        }
      }
    }
  }

  export class Module implements WebAssembly.Module {
    rpc: RpcClient;
    worker: WorkerClient;
    init: InitResponse;
    constructor(init: InitResponse, rpc: RpcClient, worker: WorkerClient) {
      this.init = init;
      this.rpc = rpc;
      this.worker = worker;
    }
  }

  export async function compile(
    bytes: BufferSource,
    createWorker: () => WorkerHandle = createSocketWorker
  ): Promise<Module> {
    let uint8Buffer: Uint8Array;
    if (bytes instanceof ArrayBuffer) {
      uint8Buffer = new Uint8Array(bytes);
    } else {
      uint8Buffer = new Uint8Array(bytes.buffer);
    }
    const worker = new WorkerClient(configuration, createWorker);
    const rpc = new RpcClientImpl(worker);
    worker.postRequest({
      type: "Configure",
      inner: configuration,
    });
    await worker.receive("SetConfiguration");
    await worker.receive("OnSocketOpen");
    rpc.binaryRequest(uint8Buffer);
    const init = await rpc.textResponse("Init");
    return new Module(init, rpc, worker);
  }

  export async function instantiate(
    moduleObjectOrBytes: WasmInspect.Module | BufferSource,
    importObject?: WebAssembly.Imports
  ): Promise<any> {
    if (moduleObjectOrBytes instanceof WasmInspect.Module) {
      return Promise.resolve(new Instance(moduleObjectOrBytes, importObject));
    } else {
      const module = await compile(moduleObjectOrBytes);
      const instance = new Instance(module, importObject);
      return Promise.resolve({ module, instance });
    }
  }
}
