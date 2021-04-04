import { TextRequest, TextResponse } from "./socket-rpc";
import {
  SocketRequest,
  SocketResponse,
  WorkerRequest,
  WorkerResponse,
} from "./worker-rpc";
import { WorkerHandle, WorkerPort } from "./worker";
import { Config } from "./config";

type _ResponseKind = WorkerResponse["type"];
type _SelectResponse<T extends _ResponseKind> = Extract<
  WorkerResponse,
  { type: T }
>;

export class WorkerClient {
  private worker: WorkerHandle;
  private queue: WorkerResponse[];
  private configuration: Config;
  private onmessage: ((event: any) => void) | null;

  constructor(configuration: Config, workerFactory: () => WorkerHandle) {
    this.worker = workerFactory();
    this.configuration = configuration;
    this.queue = [];
    this.onmessage = null;
    this.worker.addEventListener("message", (event: any) => {
      const response = event.data;
      if (configuration.debugEnabled) {
        console.log(
          "[wasminspect-web] [main thread] <- [worker thread] ",
          response
        );
      }
      if (this.onmessage) {
        this.onmessage(response);
      } else {
        this.queue.push(response);
      }
    });
    this.worker.addEventListener("error", (event: any) => {
      console.error(
        "[wasminspect-web] [main thread] Unhandled error event: ",
        event.data
      );
    });
  }

  async terminate() {
    await this.worker.terminate();
  }

  async receive<T extends _ResponseKind>(type: T): Promise<_SelectResponse<T>> {
    const response = await this._receive();
    if (response.type == type) {
      return Promise.resolve(response as any);
    } else {
      return Promise.reject(
        new Error(
          `[wasminspect-web] Unexpected response: ${JSON.stringify(
            response
          )}, expected: ${type}`
        )
      );
    }
  }
  blockingReceive<T extends _ResponseKind>(type: T): _SelectResponse<T> {
    const response = this._blockingReceive();
    if (response.type == type) {
      return response as any;
    } else {
      throw new Error(
        `[wasminspect-web] Unexpected response: ${response}, expected: ${type}`
      );
    }
  }
  postRequest(request: WorkerRequest, isBlocking: boolean = false) {
    if (
      request.type == "SocketRequest" &&
      request.inner.type == "BinaryRequest"
    ) {
      this._postRequest(request, isBlocking, [request.inner.body.buffer]);
    } else {
      this._postRequest(request, isBlocking);
    }
  }

  private _postRequest(data: any, isBlocking: boolean, transfer: any[] = []) {
    this.worker.postMessage({ ...data, isBlocking }, transfer);
  }

  private async _receive(): Promise<WorkerResponse> {
    const found = this.queue.shift();
    if (found) {
      return Promise.resolve(found);
    }
    return new Promise((resolve) => {
      this.onmessage = (response) => {
        this.onmessage = null;
        resolve(response);
      };
    });
  }

  private _blockingReceive(): WorkerResponse {
    const prologue: () => [number, number] = () => {
      // [0..<4] = json **string** size (not bytes length)
      // [4..<8] = extra bytes array length
      // [8]     = notification flag
      const sizeBuffer = new SharedArrayBuffer(4 + 4 + 1);
      const intView = new Uint32Array(sizeBuffer, 0, 2);
      const flagView = new Uint8Array(sizeBuffer, 8, 1);
      this.postRequest({ type: "BlockingPrologue", sizeBuffer }, true);

      const start = new Date().getTime();
      let now = new Date().getTime();

      while (Atomics.compareExchange(flagView, 0, 1, 0) == 0) {
        now = new Date().getTime();
        if (now - start > this.configuration.blockingTimeout) {
          throw new Error("[wasminspect-web] Timeout BlockingPrologue");
        }
      }
      return [intView[0], intView[1]];
    };

    const epilogue: (
      jsonLen: number,
      bytesLen: number
    ) => [string, Uint8Array] = (jsonLen, bytesLen) => {
      // the last byte is reserved for notification flag.
      const bodyBuffer = new SharedArrayBuffer(jsonLen * 2 + bytesLen + 1);
      const stringView = new Uint16Array(bodyBuffer, 0, jsonLen);
      const byteView = new Uint8Array(bodyBuffer, jsonLen * 2, bytesLen);
      const flagView = new Uint8Array(bodyBuffer, jsonLen * 2 + bytesLen, 1);
      this.postRequest(
        { type: "BlockingEpilogue", bodyBuffer: bodyBuffer },
        true
      );

      const start = new Date().getTime();
      let now = new Date().getTime();

      while (Atomics.compareExchange(flagView, 0, 1, 0) == 0) {
        now = new Date().getTime();
        if (now - start > this.configuration.blockingTimeout) {
          throw new Error("[wasminspect-web] Timeout BlockingEpilogue");
        }
      }
      return [String.fromCharCode(...stringView), byteView];
    };

    const [jsonLen, bytesLen] = prologue();
    const [jsonString, bytes] = epilogue(jsonLen, bytesLen);
    const response = JSON.parse(jsonString);
    if (
      response.type === "SocketResponse" &&
      response.inner.type === "BinaryResponse"
    ) {
      response.inner.body = bytes;
    }
    return response;
  }
}
