import { Request, TextRequest, Response, TextResponse } from "./rpc"
import { WorkerPort } from "./worker";
import createSocketWorker from "./worker-constructor"

export namespace WasmInspect {
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

    type _ResponseKind = Response["type"]
    type _SelectResponse<T extends _ResponseKind> = Extract<Response, { type: T }>['body'];
    class _Worker {
        private worker: WorkerPort;
        private queue: MessageEvent[];
        private onmessage: ((event: MessageEvent) => void) | null
        constructor() {
            this.worker = createSocketWorker();
            this.queue = [];
            this.onmessage = null;
            this.worker.addEventListener("message", (event: any) => {
                if (this.onmessage) {
                    this.onmessage(event)
                } else {
                    this.queue.push(event);
                }
            });
            // this.worker.addEventListener("error", (event: any) => {
            //     console.error(`Unhandled error event in debugging WebAssembly worker: ${JSON.stringify(event)}`)
            // });
        }

        async waitSocketOpen() {
            return new Promise<void>((resolve, reject) => {
                this.onmessage = (event) => {
                    this.onmessage = null;
                    const response = event.data as { type: "OnSocketOpen" };
                    if (response.type == "OnSocketOpen") {
                        resolve();
                    } else {
                        reject(new Error(`unexpected event: ${event}, expected OnSocketOpen`));
                    }
                }
            })
        }

        async receive<T extends _ResponseKind>(type: T): Promise<_SelectResponse<T>> {
            const found = this.queue.shift();
            if (found) {
                const response = found.data as Response;
                if (response.type == type) {
                    return response.body;
                } else {
                    return Promise.reject(new Error(`unexpected response type: ${response.type}. expected ${type}`));
                }
            }
            return new Promise((resolve, reject) => {
                this.onmessage = (event) => {
                    this.onmessage = null;
                    const response = event.data as Response;
                    if (response.type == type) {
                        resolve(response.body);
                    } else {
                        const e = new Error(`unexpected response type: ${response.type}. expected ${type}`);
                        reject(e);
                    }
                }
            })
        }

        textRequest(body: TextRequest) {
            const request: Request = {
                type: "TextRequest",
                body: body,
            };
            this.worker.postMessage(request);
        }

        binaryRequest(body: Uint8Array) {
            const request: Request = {
                type: "BinaryRequest",
                body: body,
            };
            this.worker.postMessage(request, [body.buffer]);
        }
    }

    type _TextResponseKind = TextResponse["type"]
    type _SelectTextResponse<T extends _TextResponseKind> = Extract<TextResponse, { type: T }>;
    function _castTextResponse<T extends _TextResponseKind>(response: TextResponse, type: T): _SelectTextResponse<T> {
        if (response.type == type) {
            return response as _SelectTextResponse<T>;
        } else {
            throw new Error(`type mismatch error: expected "${type}" but actual "${response.type}"`);
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
        await worker.waitSocketOpen();
        worker.binaryRequest(uint8Buffer);
        const response = await worker.receive("TextResponse");
        _castTextResponse(response, "Init");
        return new Module(worker);
    }

    // export function instantiate(bytes: BufferSource, importObject?: WebAssembly.Imports): Promise<WebAssembly.WebAssemblyInstantiatedSource> {
    // }
}
