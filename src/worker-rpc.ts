import { Config } from "./config";

export type WorkerRequest =
  | {
      type: "Configure";
      inner: Config;
    }
  | {
      type: "Terminate";
    }
  | {
      type: "SocketRequest";
      inner: SocketRequest;
    }
  | {
      type: "BlockingPrologue";
      sizeBuffer: SharedArrayBuffer;
    }
  | {
      type: "BlockingEpilogue";
      bodyBuffer: SharedArrayBuffer;
    };

export type SocketRequest =
  | {
      type: "TextRequest";
      body: string;
    }
  | {
      type: "BinaryRequest";
      body: Uint8Array;
    };

export type SocketResponse =
  | {
      type: "TextResponse";
      body: string;
    }
  | {
      type: "BinaryResponse";
      body: Uint8Array;
    };

export type WorkerResponse =
  | {
      type: "OnSocketOpen";
    }
  | {
      type: "SetConfiguration";
    }
  | {
      type: "Terminated";
    }
  | {
      type: "SocketResponse";
      inner: SocketResponse;
    };
