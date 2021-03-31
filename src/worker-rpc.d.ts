import { SocketRequest, SocketResponse } from "./socket-rpc"

export type WorkerRequest = {
    type: "Configure",
    debugEnabled: boolean,
    socketAddr: string,
} | {
    type: "SocketRequest",
    inner: SocketRequest,
}

export type WorkerResponse = {
    type: "OnSocketOpen"
} | {
    type: "SetConfiguration",
} | {
    type: "SocketResponse",
    inner: SocketResponse,
}
