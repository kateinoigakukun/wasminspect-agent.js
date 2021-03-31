export type WasmValue =
    { type: "I32", value: number } |
    { type: "I64", value: number } |
    { type: "F32", value: number } |
    { type: "F64", value: number }


export type TextRequest = {
    type: "Version",
} | {
    type: "CallExported",
    name: string,
    args: number[],
} | {
    type: "CallResult",
    values: number[],
}

export type SocketRequest = {
    type: "TextRequest",
    body: TextRequest
} | {
    type: "BinaryRequest",
    body: Uint8Array,
}

export type TextResponse = {
    type: "Version",
    value: String,
} | {
    type: "Init"
} | {
    type: "CallResult",
    values: WasmValue[]
}

export type SocketResponse = {
    type: "TextResponse",
    body: TextResponse
}
