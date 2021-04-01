import { Config } from "./config";

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

export type SocketRequest = {
    type: "TextRequest",
    body: string
} | {
    type: "BinaryRequest",
    body: Uint8Array,
}

export type SocketResponse = {
    type: "TextResponse",
    body: string
}

export type WorkerResponse = {
    type: "OnSocketOpen"
} | {
    type: "SetConfiguration",
} | {
    type: "SocketResponse",
    inner: SocketResponse,
}
