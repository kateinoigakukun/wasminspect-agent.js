import { BinaryResponse, BinaryResponseKind, TextRequest, TextResponse } from "./socket-rpc";
import { WorkerClient } from "./worker-client";
import { SocketResponse, WorkerRequest } from "./worker-rpc";

export type _TextResponseKind = TextResponse["type"];
export type _SelectTextResponse<T extends _TextResponseKind> = Extract<
  TextResponse,
  { type: T }
>;
function _castTextResponse<T extends _TextResponseKind>(
  response: SocketResponse,
  type: T
): _SelectTextResponse<T> {
  if (response.type == "TextResponse") {
    const body = JSON.parse(response.body) as TextResponse;
    if (body.type == type) {
      return body as _SelectTextResponse<T>;
    } else {
      throw new Error(
        `[wasminspect-client] Unexpected response: ${JSON.stringify(
          response
        )}. expected: ${type}`
      );
    }
  } else {
    throw new Error(
      `[wasminspect-client] Unexpected response: ${JSON.stringify(response)}. expected: TextResponse`
    );
  }
}

function _castBinaryResponse(
  response: SocketResponse,
  type: BinaryResponseKind
): Uint8Array {
  if (response.type == "BinaryResponse") {
    const kind = response.body[0] as BinaryResponseKind;
    if (kind == type) {
      return response.body.subarray(1);
    } else {
      throw new Error(
        `[wasminspect-client] Unexpected response: ${response}. expected: ${type}`
      );
    }
  } else {
    throw new Error(
      `[wasminspect-client] Unexpected response: ${JSON.stringify(response)}. expected: BinaryResponse`
    );
  }
}

export interface RpcClient {
  textRequest(body: TextRequest, isBlocking: boolean): void;
  binaryRequest(body: Uint8Array, isBlocking: boolean): void;

  textResponse<T extends _TextResponseKind>(
    type: T
  ): Promise<_SelectTextResponse<T>>;
  blockingTextResponse<T extends _TextResponseKind>(
    type: T
  ): _SelectTextResponse<T>;
  blockingReceive(): SocketResponse;
}

export class RpcClientImpl implements RpcClient {
  private workerClient: WorkerClient;
  constructor(worker: WorkerClient) {
    this.workerClient = worker;
  }

  textRequest(body: TextRequest, isBlocking: boolean = false) {
    const request: WorkerRequest = {
      type: "SocketRequest",
      inner: {
        type: "TextRequest",
        body: JSON.stringify(body),
      },
    };
    this.workerClient.postRequest(request, isBlocking);
  }

  binaryRequest(body: Uint8Array, isBlocking: boolean = false) {
    const request: WorkerRequest = {
      type: "SocketRequest",
      inner: {
        type: "BinaryRequest",
        body,
      },
    };
    this.workerClient.postRequest(request, isBlocking);
  }

  async textResponse<T extends _TextResponseKind>(
    type: T
  ): Promise<_SelectTextResponse<T>> {
    return _castTextResponse(await this.receive(), type);
  }

  async binaryResponse(type: BinaryResponseKind): Promise<Uint8Array> {
    return _castBinaryResponse(await this.receive(), type);
  }

  blockingTextResponse<T extends _TextResponseKind>(
    type: T
  ): _SelectTextResponse<T> {
    return _castTextResponse(this.blockingReceive(), type);
  }

  blockingBinaryResponse(type: BinaryResponseKind): Uint8Array {
    return _castBinaryResponse(this.blockingReceive(), type);
  }

  private async receive(): Promise<SocketResponse> {
    return (await this.workerClient.receive("SocketResponse")).inner;
  }

  blockingReceive(): SocketResponse {
    return this.workerClient.blockingReceive("SocketResponse").inner;
  }
}
