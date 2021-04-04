import { RpcClient } from "../rpc-client";

export class RemoteMemoryBuffer implements ArrayBuffer {
  [Symbol.toStringTag]: string;
  byteLength: number;
  private name: string;
  private offset: number;
  private rpc: RpcClient;

  constructor(name: string, offset: number, length: number, rpc: RpcClient) {
    this[Symbol.toStringTag] = "RemoteMemoryBuffer";
    this.name = name;
    this.offset = offset;
    this.byteLength = length;
    this.rpc = rpc;
  }

  private _resolveSubrange(
    start?: number,
    end?: number
  ): { begin: number; end: number } | undefined {
    let _start = start || 0;
    let _end = end || this.byteLength;
    if (this.byteLength < _end) {
      return undefined;
    }
    if (_start < 0) {
      _start = this.byteLength + _start;
    }
    if (_end < 0) {
      _end = this.byteLength + _end;
    }
    return { begin: _start, end: _end };
  }

  subarray(start?: number, end?: number): RemoteMemoryBuffer {
    const range = this._resolveSubrange(start, end);
    if (!range) {
      return new RemoteMemoryBuffer(this.name, 0, 0, this.rpc);
    }
    return new RemoteMemoryBuffer(
      this.name,
      this.offset + range.begin,
      range.end - range.begin,
      this.rpc
    );
  }

  slice(start?: number, end?: number): ArrayBuffer {
    const range = this._resolveSubrange(start, end);
    if (!range) {
      return new ArrayBuffer(0);
    }
    this.rpc.textRequest(
      {
        type: "LoadMemory",
        name: this.name,
        offset: this.offset + range.begin,
        length: range.end - range.begin,
      },
      true
    );
    const result = this.rpc.blockingTextResponse("LoadMemoryResult");
    const bytes = new Uint8Array(result.bytes);
    return bytes.buffer;
  }

  _validRange(start: number, end: number): boolean {
    return !(start < 0 || this.byteLength < end);
  }

  sliceWithCanonicalIndex(start: number, end: number): ArrayBuffer | undefined {
    if (!this._validRange(start, end)) {
      return undefined;
    }
    return this.slice(start, end);
  }

  set(offset: number, bytes: number[]): void {
    this.rpc.textRequest(
      {
        type: "StoreMemory",
        name: this.name,
        offset: this.offset + offset,
        bytes: bytes,
      },
      true
    );
    this.rpc.blockingTextResponse("StoreMemoryResult");
  }

  setWithCanonicalIndex(offset: number, bytes: number[]): boolean {
    if (!this._validRange(offset, offset + bytes.length)) {
      return false;
    }
    this.set(offset, bytes);
    return true;
  }
}
