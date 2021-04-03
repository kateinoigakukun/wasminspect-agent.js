import { WasmInspect } from "../dist";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs"

const WASMINSPECT_SERVER_PATH = process.env.WASMINSPECT_SERVER_PATH;
if (WASMINSPECT_SERVER_PATH) {
  describe("WebAssembly Interface", () => {
    let serverProcess: ChildProcess | null = null;
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
      await WasmInspect.destroy(module as any);
    });

    test("instantiate with exports", async () => {
      const props = await WebAssembly.instantiate(createBytes("nop.wasm"));
      const instance = props.instance;
      expect(Object.keys(instance.exports)).toEqual(["start"]);
      (instance.exports.start as any)()
      await WasmInspect.destroy(props.module as any);
    });

    test("remote call", async () => {
      const props = await WebAssembly.instantiate(createBytes("remote-call.wasm"));
      const instance = props.instance;
      expect(Object.keys(instance.exports)).toEqual(["ret_42", "with_arg"]);
      expect((instance.exports.ret_42 as any)()).toBe(42)
      expect((instance.exports.with_arg as any)(24)).toBe(24)
      await WasmInspect.destroy(props.module as any);
    });

  });
} else {
  test.skip("No WASMINSPECT_SERVER_PATH", () => {});
}
