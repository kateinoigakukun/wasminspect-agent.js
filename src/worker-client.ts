import { SocketRequest, TextRequest, SocketResponse, TextResponse } from "./socket-rpc"
import { WorkerRequest, WorkerResponse } from "./worker-rpc";
import { WorkerPort } from "./worker";
import createSocketWorker from "./worker-constructor"
import { Config } from "./config";

type _ResponseKind = WorkerResponse["type"]
type _SelectResponse<T extends _ResponseKind> = Extract<WorkerResponse, { type: T }>;

export class WorkerClient {
    private worker: WorkerPort;
    private queue: WorkerResponse[];
    private configuration: Config;
    private onmessage: ((event: WorkerResponse) => void) | null;

    constructor(configuration: Config) {
        this.worker = createSocketWorker();
        this.configuration = configuration;
        this.queue = [];
        this.onmessage = null;
        this.worker.addEventListener("message", (event: any) => {
            const response = event.data as WorkerResponse;
            if (configuration.debugEnabled) {
                console.log("[wasminspect-web] [main thread] <- [worker thread] ", JSON.stringify(response))
            }
            if (this.onmessage) {
                this.onmessage(response)
            } else {
                this.queue.push(response);
            }
        });
        this.worker.addEventListener("error", (event: any) => {
            console.error(`[wasminspect-web] [main thread] Unhandled error event: ${JSON.stringify(event.data)}`)
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

    blockingReceive<T extends _ResponseKind>(type: T): _SelectResponse<T> {
        const found = this.queue.shift();
        if (found) {
            if (found.type == type) {
                return found as any;
            } else {
                throw new Error(`[wasminspect-web] Unexpected response: ${found}, expected: ${type}`);
            }
        }
        const prologue: () => number = () => {
            // the last byte is reserved for notification flag.
            const sizeBuffer = new SharedArrayBuffer(5);
            const intView = new Uint32Array(sizeBuffer, 0, 1);
            const flagView = new Uint8Array(sizeBuffer, 4, 1);
            this.postRequest({ type: "BlockingPrologue", sizeBuffer }, true);
            console.log("start block")

            const start = new Date().getTime();
            let now = new Date().getTime();

            while (Atomics.compareExchange(flagView, 0, 1, 0) == 0 && now - start < this.configuration.blockingTimeout) {
                now = new Date().getTime();
            }
            return intView[0];
        };

        const epilogue: (length: number) => string = (length) => {
            // the last byte is reserved for notification flag.
            const jsonBuffer = new SharedArrayBuffer(length * 2 + 1);
            const stringView = new Uint16Array(jsonBuffer, 0, length);
            const flagView = new Uint8Array(jsonBuffer, length * 2, 1);
            this.postRequest({ type: "BlockingEpilogue", jsonBuffer }, true);

            const start = new Date().getTime();
            let now = new Date().getTime();

            while (Atomics.compareExchange(flagView, 0, 1, 0) == 0 && now - start < this.configuration.blockingTimeout) {
                now = new Date().getTime();
            }
            return String.fromCharCode(...stringView)
        };

        const length = prologue();
        if (this.configuration.debugEnabled) {
            console.log("[wasminspect-web] BlockingPrologue: length = ", length);
        }
        const jsonString = epilogue(length);
        if (this.configuration.debugEnabled) {
            console.log("[wasminspect-web] BlockingEpilogue: json = ", jsonString);
        }
        const response = JSON.parse(jsonString) as WorkerResponse;
        if (response.type == type) {
            return response as any;
        } else {
            throw new Error(`[wasminspect-web] Unexpected response: ${response}, expected: ${type}`)
        }
    }

    postRequest(request: WorkerRequest, isBlocking: boolean = false) {
        if (request.type == "SocketRequest" && request.inner.type == "BinaryRequest") {
            this.worker.postMessage({ ...request, isBlocking }, [request.inner.body.buffer]);
        } else {
            this.worker.postMessage({ ...request, isBlocking });
        }
    }
}
