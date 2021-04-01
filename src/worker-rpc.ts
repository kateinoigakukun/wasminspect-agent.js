import { Config } from "./config";
import { SocketRequest, SocketResponse } from "./socket-rpc"

export type WorkerRequest = {
    type: "Configure",
    inner: Config,
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
