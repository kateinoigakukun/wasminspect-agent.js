import { TextResponse } from "./socket-rpc";
import { WorkerPort } from "./worker";
import {
  SocketRequest,
  SocketResponse,
  WorkerRequest,
  WorkerResponse,
} from "./worker-rpc";

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
  waitingEpilogue: BlockingQueue<string>;
};

export interface Socket {
  onopen: (event: any) => void;
  onmessage: (event: any) => void;
  send(data: any): void;
}

export const acceptSocketEvent = (
  eventData: string | ArrayBuffer,
  state: State,
  ctx: WorkerPort
) => {
  if (state.debugEnabled) {
    console.log(
      "[wasminspect-web] [main thread] <- [worker thread] <- [socket] ",
      eventData
    );
  }
  let response: WorkerResponse;
  if (typeof eventData === "string") {
    response = {
      type: "SocketResponse",
      inner: { type: "TextResponse", body: eventData },
    } as WorkerResponse;
  } else {
    throw new Error("BinaryResponse is not supported yet");
  }

  if (state.isBlocking) {
    state.waitingPrologue.push(response);
  } else {
    ctx.postMessage(response);
  }
};

export const acceptWorkerRequest = (
  workerRequest: WorkerRequest & { isBlocking: boolean },
  state: State,
  ctx: WorkerPort,
  socketFactory: (addr: string) => Socket
) => {
  if (state.debugEnabled) {
    console.log(
      "[wasminspect-web] [main thread] -> [worker thread] ",
      JSON.stringify(workerRequest)
    );
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
      socket.onmessage = (event: any) => {
        acceptSocketEvent(event.data, state, ctx);
      };
      state.debugEnabled = workerRequest.inner.debugEnabled;
      ctx.postMessage({ type: "SetConfiguration" } as WorkerResponse);
      break;
    }
    case "BlockingPrologue": {
      if (!oldIsBlocking) {
        console.error(
          "BlockingPrologue should be called after blocking request"
        );
      }
      state.waitingPrologue.consume((msg) => {
        const intView = new Uint32Array(workerRequest.sizeBuffer, 0, 1);
        const flagView = new Uint8Array(workerRequest.sizeBuffer, 4, 1);
        const json = JSON.stringify(msg);
        Atomics.store(intView, 0, json.length);
        Atomics.store(flagView, 0, 1);
        state.waitingEpilogue.push(json);
      });
      break;
    }
    case "BlockingEpilogue": {
      if (!oldIsBlocking) {
        console.error(
          "BlockingEpilogue should be called after blocking request"
        );
      }
      state.waitingEpilogue.consume((json) => {
        const stringView = new Uint16Array(
          workerRequest.jsonBuffer,
          0,
          json.length
        );
        const flagView = new Uint8Array(
          workerRequest.jsonBuffer,
          json.length * 2,
          1
        );
        for (let idx = 0; idx < json.length; idx++) {
          Atomics.store(stringView, idx, json.charCodeAt(idx));
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
