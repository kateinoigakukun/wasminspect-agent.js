import { WorkerPort } from "./worker";
import { SocketRequest, WorkerRequest, WorkerResponse } from "./worker-rpc";

export class BlockingQueue<T> {
  private pendings: T[];
  private onpush: ((message: T) => void) | null;

  constructor() {
    this.pendings = [];
    this.onpush = null;
  }
  push(message: T) {
    if (this.onpush) {
      this.onpush(message);
    } else {
      this.pendings.push(message);
    }
  }

  consume(f: (message: T) => void) {
    if (this.pendings.length > 0) {
      const head = this.pendings.shift()!;
      f(head);
      return;
    } else {
      if (this.onpush != null) {
        console.error("Can't wait multiple event at once.");
        return;
      }
      this.onpush = (message) => {
        this.onpush = null;
        f(message);
      };
    }
  }
}

export type State = {
  debugEnabled: boolean;
  isBlocking: boolean;
  socket: Socket | null;
  waitingPrologue: BlockingQueue<WorkerResponse>;
  waitingEpilogue: BlockingQueue<{ json: string; bytes: Uint8Array | null }>;
};

export interface Socket {
  onopen: (event: any) => void;
  onmessage: (event: any) => void;
  onclose: (event: any) => void;
  send(data: any): void;
  close(): void;
}

export const acceptSocketEvent = async (
  eventData: string | Blob | Buffer,
  state: State,
  ctx: WorkerPort
) => {
  let response: WorkerResponse;
  if (typeof eventData === "string") {
    if (state.debugEnabled) {
      console.log(
        "[wasminspect-web] [main thread] <- [worker thread] <- [socket] ",
        eventData
      );
    }
    response = {
      type: "SocketResponse",
      inner: { type: "TextResponse", body: eventData },
    } as WorkerResponse;
  } else {
    if (state.debugEnabled) {
      console.log(
        "[wasminspect-web] [main thread] <- [worker thread] <- [socket]  [[bytes]]"
      );
    }
    let bodyBuffer;
    if (Buffer !== undefined && eventData instanceof Buffer) {
      bodyBuffer = eventData;
    } else if (Blob !== undefined && eventData instanceof Blob) {
      console.log(eventData)
      bodyBuffer = await eventData.arrayBuffer();
    } else {
      throw new Error(`[wasminspect-web] Unexpected event type: ${eventData}`);
    }
    response = {
      type: "SocketResponse",
      inner: { type: "BinaryResponse", body: new Uint8Array(bodyBuffer) },
    } as WorkerResponse;
  }

  if (state.isBlocking) {
    state.waitingPrologue.push(response);
  } else {
    if (
      response.type === "SocketResponse" &&
      response.inner.type === "BinaryResponse"
    ) {
      ctx.postMessage(response, [response.inner.body.buffer]);
    } else {
      ctx.postMessage(response);
    }
  }
};

export const acceptWorkerRequest = (
  workerRequest: WorkerRequest & { isBlocking: boolean },
  state: State,
  ctx: WorkerPort,
  socketFactory: (addr: string) => Socket
) => {
  if (state.debugEnabled) {
    if (
      workerRequest.type !== "SocketRequest" ||
      workerRequest.inner.type !== "BinaryRequest"
    ) {
      console.log(
        "[wasminspect-web] [main thread] -> [worker thread] ",
        JSON.stringify(workerRequest)
      );
    } else {
      console.log(
        "[wasminspect-web] [main thread] -> [worker thread] ",
        JSON.stringify({
          type: workerRequest.type,
          inner: {
            type: workerRequest.inner.type,
            body: "[[bytes]]",
          },
        })
      );
    }
  }
  const oldIsBlocking = state.isBlocking;
  state.isBlocking = workerRequest.isBlocking;

  switch (workerRequest.type) {
    case "Configure": {
      const socket = socketFactory(workerRequest.inner.socketAddr);
      state.socket = socket;
      socket.onopen = () => {
        ctx.postMessage({ type: "OnSocketOpen" } as WorkerResponse);
      };
      socket.onmessage = async (event: any) => {
        await acceptSocketEvent(event.data, state, ctx);
      };
      socket.onclose = (event: any) => {
        if (state.isBlocking) {
          state.waitingPrologue.push({ type: "Terminated" });
        } else {
          ctx.postMessage({ type: "Terminated" } as WorkerResponse);
        }
      };
      (socket as any).onerror = (event: any) => {
        if (state.isBlocking) {
          state.waitingPrologue.push({ type: "Terminated" });
        } else {
          ctx.postMessage({ type: "Terminated" } as WorkerResponse);
        }
      };
      state.debugEnabled = workerRequest.inner.debugEnabled;
      ctx.postMessage({ type: "SetConfiguration" } as WorkerResponse);
      break;
    }
    case "Terminate": {
      state.socket?.close();
      ctx.postMessage({ type: "Terminated" } as WorkerResponse);
      break;
    }
    case "BlockingPrologue": {
      if (!oldIsBlocking) {
        console.error(
          "BlockingPrologue should be called after blocking request"
        );
      }
      state.waitingPrologue.consume((msg) => {
        // [0..<4] = json **string** size (not bytes length)
        // [4..<8] = extra bytes array length
        // [8]     = notification flag
        const intView = new Uint32Array(workerRequest.sizeBuffer, 0, 2);
        const flagView = new Uint8Array(workerRequest.sizeBuffer, 8, 1);
        let jsonObject;
        let extraBytes = null;
        if (
          msg.type === "SocketResponse" &&
          msg.inner.type === "BinaryResponse"
        ) {
          extraBytes = msg.inner.body;
          msg.inner.body = new Uint8Array();
          jsonObject = { type: "SocketResponse", inner: msg.inner };
        } else {
          jsonObject = msg;
        }
        const json = JSON.stringify(jsonObject);
        Atomics.store(intView, 0, json.length);
        Atomics.store(intView, 1, extraBytes?.length || 0);
        Atomics.store(flagView, 0, 1);
        state.waitingEpilogue.push({ json, bytes: extraBytes });
      });
      break;
    }
    case "BlockingEpilogue": {
      if (!oldIsBlocking) {
        console.error(
          "BlockingEpilogue should be called after blocking request"
        );
      }
      state.waitingEpilogue.consume((props) => {
        const json = props.json;
        const bytes = props.bytes;
        const stringView = new Uint16Array(
          workerRequest.bodyBuffer,
          0,
          json.length
        );
        const extraBytesLen = bytes?.length || 0;
        const byteView = new Uint8Array(
          workerRequest.bodyBuffer,
          json.length * 2,
          extraBytesLen
        );
        const flagView = new Uint8Array(
          workerRequest.bodyBuffer,
          json.length * 2 + extraBytesLen,
          1
        );
        for (let idx = 0; idx < json.length; idx++) {
          Atomics.store(stringView, idx, json.charCodeAt(idx));
        }
        if (bytes) {
          for (let idx = 0; idx < bytes.length; idx++) {
            Atomics.store(byteView, idx, bytes[idx]);
          }
        }
        Atomics.store(flagView, 0, 1);
      });
      break;
    }
    case "SocketRequest": {
      if (!state.socket) {
        console.error("SocketRequest should be called after Configure");
        return;
      }
      const request: SocketRequest = workerRequest.inner;
      switch (request.type) {
        case "TextRequest": {
          state.socket.send(request.body);
          break;
        }
        case "BinaryRequest": {
          state.socket.send(request.body);
          break;
        }
        default: {
          console.error("Unexpected SocketRequest type: ", request);
          break;
        }
      }
      break;
    }
  }
};
