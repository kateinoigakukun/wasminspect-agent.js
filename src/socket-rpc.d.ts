export type WasmValue =
    { type: "I32", value: number } |
    { type: "I64", value: number } |
    { type: "F32", value: number } |
    { type: "F64", value: number }

export type WasmExport = ({
    type: "Memory",
    memorySize: number,
} | {
    type: "Function" | "Global" | "Table",
}) & {
    name: string
};

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

export type InitResponse = {
    type: "Init",
    exports: WasmExport[],
};

export type TextResponse = {
    type: "Version",
    value: String,
} | {
    type: "CallResult",
    values: WasmValue[]
} | InitResponse;

export type SocketResponse = {
    type: "TextResponse",
    body: TextResponse
}
