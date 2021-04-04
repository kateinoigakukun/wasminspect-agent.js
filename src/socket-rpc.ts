export type WasmValue =
  | { type: "I32"; value: number }
  | { type: "I64"; value: number }
  | { type: "F32"; value: number }
  | { type: "F64"; value: number };

export type WasmExport = (
  | {
      type: "Memory";
      memorySize: number;
    }
  | {
      type: "Function" | "Global" | "Table";
    }
) & {
  name: string;
};

export type TextRequest =
  | {
      type: "Version";
    }
  | {
      type: "InitMemory";
    }
  | {
      type: "CallExported";
      name: string;
      args: number[];
    }
  | {
      type: "CallResult";
      values: number[];
    }
  | {
      type: "LoadMemory";
      name: string;
      offset: number;
      length: number;
    }
  | {
      type: "StoreMemory";
      name: string;
      offset: number;
      bytes: number[];
    };

export type InitResponse = {
  type: "Init";
  exports: WasmExport[];
};

export type TextResponse =
  | {
      type: "Version";
      value: String;
    }
  | {
      type: "CallResult";
      values: WasmValue[];
    }
  | {
      type: "CallHost";
      module: string;
      field: string;
      args: WasmValue[];
    }
  | {
      type: "LoadMemoryResult";
      bytes: number[];
    }
  | {
      type: "StoreMemoryResult";
    }
  | InitResponse;

export enum BinaryResponseKind {
  InitMemory = 0,
}
export type BinaryResponse = {
  type: BinaryResponseKind;
  bytes: Uint8Array;
};
