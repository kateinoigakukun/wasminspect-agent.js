import { SocketRequest, TextRequest, SocketResponse, TextResponse } from "./socket-rpc"
import { WorkerRequest, WorkerResponse } from "./worker-rpc";
import { WorkerPort } from "./worker";
import createSocketWorker from "./worker-constructor"

export namespace WasmInspect {

    export let debugEnabled: boolean = false;
    export let socketAddr: string = "ws://127.0.0.1:4000/debugger";

    class Instance implements WebAssembly.Instance {
        exports: WebAssembly.Exports;
        constructor(module: WebAssembly.Module, importObjects?: WebAssembly.Imports) {
            this.exports = {};
        }
    }

    class Module implements WebAssembly.Module {
        private _worker: _Worker
        constructor(_worker: _Worker) {
            this._worker = _worker
        }
    }

    type _ResponseKind = WorkerResponse["type"]
    type _SelectResponse<T extends _ResponseKind> = Extract<WorkerResponse, { type: T }>;
    class _Worker {
        private worker: WorkerPort;
        private queue: WorkerResponse[];
        private onmessage: ((event: WorkerResponse) => void) | null
        constructor() {
            this.worker = createSocketWorker();
            this.queue = [];
            this.onmessage = null;
            this.worker.addEventListener("message", (event: any) => {
                const response = event.data as WorkerResponse;
                if (debugEnabled) {
                    console.log("[wasminspect-web] [main thread] <- [worker thread] ", JSON.stringify(response))
                }
                if (this.onmessage) {
                    this.onmessage(response)
                } else {
                    this.queue.push(response);
                }
            });
            this.worker.addEventListener("error", (event: any) => {
                console.error(`[wasminspect-web] [main thread] Unhandled error event in debugging WebAssembly worker: ${JSON.stringify(event)}`)
            });
        }

        async receive<T extends _ResponseKind>(type: T): Promise<_SelectResponse<T>> {
            const found = this.queue.shift();
            if (found) {
                if (found.type == type) {
                    return found as any;
                } else {
                    return Promise.reject(new Error(`[wasminspect-web] Unexpected response: ${found}, expected: ${type}`));
                }
            }
            return new Promise((resolve, reject) => {
                this.onmessage = (response) => {
                    this.onmessage = null;
                    if (response.type == type) {
                        resolve(response as any);
                    } else {
                        const e = new Error(`[wasminspect-web] Unexpected response: ${response}. expected: ${type}`);
                        reject(e);
                    }
                }
            })
        }

        postRequest(request: WorkerRequest) {
            if (request.type == "SocketRequest" && request.inner.type == "BinaryRequest") {
                this.worker.postMessage(request, [request.inner.body.buffer]);
            } else {
                this.worker.postMessage(request);
            }
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
        const worker = new _Worker();
        await worker.postRequest({
            type: "Configure",
            debugEnabled,
            socketAddr,
        });
        await worker.receive("OnSocketOpen");
        worker.postRequest(_createBinaryRequest(uint8Buffer));
        const response = await worker.receive("SocketResponse");
        _castTextResponse(response.inner, "Init");
        return new Module(worker);
    }

    // export function instantiate(bytes: BufferSource, importObject?: WebAssembly.Imports): Promise<WebAssembly.WebAssemblyInstantiatedSource> {
    // }
}
