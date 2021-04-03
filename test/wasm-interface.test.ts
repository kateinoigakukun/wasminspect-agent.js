import { WasmInspect } from "../dist";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";

const WASMINSPECT_SERVER_PATH = process.env.WASMINSPECT_SERVER_PATH;
const WASMINSPECT_SERVER_ADDR = process.env.WASMINSPECT_SERVER_ADDR;
if (WASMINSPECT_SERVER_PATH || WASMINSPECT_SERVER_ADDR) {
  describe("WebAssembly Interface", () => {
    let serverProcess: ChildProcess | null = null;
    if (WASMINSPECT_SERVER_ADDR) {
      WasmInspect.configuration.socketAddr = WASMINSPECT_SERVER_ADDR;
    } else if (WASMINSPECT_SERVER_PATH) {
      beforeEach(() => {
        serverProcess = spawn(WASMINSPECT_SERVER_PATH, {
          env: {
            WASMINSPECT_SERVER_NO_INTERACTIVE: "1",
          },
        });
        serverProcess.stdout!.on("data", (data) => {
          console.log(data.toString());
        });
      });

      afterEach(() => {
        serverProcess!.kill();
      });
    }

    WasmInspect.init(global);

    const createBytes = (fixture: string) => {
      const file = path.join(__dirname, "fixtures", fixture);
      const buffer = fs.readFileSync(file);
      const bytes = new Uint8Array(buffer as any).buffer;
      return bytes;
    };

    WasmInspect.configuration.debugEnabled = true;

    test("compile", async () => {
      const module = await WebAssembly.compile(createBytes("nop.wasm"));
      await WasmInspect.destroy(module);
    });

    test("instantiate with exports", async () => {
      const props = await WebAssembly.instantiate(createBytes("nop.wasm"));
      const instance = props.instance;
      expect(Object.keys(instance.exports)).toEqual(["start"]);
      (instance.exports.start as any)();
      await WasmInspect.destroy(props.module);
    });

    test("remote call", async () => {
      const props = await WebAssembly.instantiate(
        createBytes("remote-call.wasm")
      );
      const instance = props.instance;
      expect(Object.keys(instance.exports)).toEqual(["ret_42", "with_arg"]);
      expect((instance.exports.ret_42 as any)()).toBe(42);
      expect((instance.exports.with_arg as any)(24)).toBe(24);
      await WasmInspect.destroy(props.module);
    });

    test("memory operation", async () => {
      const PAGE_SIZE = 0x010000;
      const props = await WebAssembly.instantiate(
        createBytes("memory-op.wasm")
      );
      const instance = props.instance;
      expect(Object.keys(instance.exports)).toContain("memory");
      const exports = instance.exports as {
        memory: WebAssembly.Memory,
        internal_store_i32: (addr: number, val: number) => void
        internal_read_i32: (addr: number) => number
        internal_store_f32: (addr: number, val: number) => void
        internal_read_f32: (addr: number) => number
      };

      const memory = exports.memory;
      expect(memory.buffer.byteLength).toBe(PAGE_SIZE);

      const u8Buffer = new Uint8Array(memory.buffer)
      const u8Slice = u8Buffer.slice(0, 10);
      expect(Array.from(u8Slice)).toEqual(Array(10).fill(0));

      u8Buffer[0] = 0xFF;
      expect(exports.internal_read_i32(0)).toBe(0xFF);

      exports.internal_store_i32(1, 0xF0);
      expect(u8Buffer[1]).toBe(0xF0);

      const f32Buffer = new Float32Array(memory.buffer);
      f32Buffer[0] = 0.25;
      expect(exports.internal_read_f32(0)).toBe(0.25);

      exports.internal_store_f32(0, 0.75);
      expect(f32Buffer[0]).toBe(0.75);

      await WasmInspect.destroy(props.module);
    });
  });
} else {
  test.skip("No WASMINSPECT_SERVER_PATH and WASMINSPECT_SERVER_ADDR", () => {});
}
