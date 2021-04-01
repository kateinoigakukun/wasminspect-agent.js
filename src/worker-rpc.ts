import { SocketRequest, SocketResponse } from "./socket-rpc"

class WorkerBlockingToken {
    buffer: Int32Array;
}

export type WorkerRequest = {
    type: "Configure",
    debugEnabled: boolean,
    socketAddr: string,
} | {
    type: "SocketRequest",
    inner: SocketRequest,
} | {
    type: "BlockingPrologue",
    sizeBuffer: SharedArrayBuffer,
} | {
    type: "BlockingEpilogue",
    jsonBuffer: SharedArrayBuffer,
}

export type WorkerResponse = {
    type: "OnSocketOpen"
} | {
    type: "SetConfiguration",
} | {
    type: "SocketResponse",
    inner: SocketResponse,
}
