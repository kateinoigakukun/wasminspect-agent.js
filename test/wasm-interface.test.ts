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

    // prettier-ignore
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

    test.skip("instantiate with bytes", async () => {
      const props = await WebAssembly.instantiate(createBytes("nop.wasm"));
      const instance = props.instance;
      console.log(instance.exports)
      expect(instance.exports.start).not.toBe(undefined);
      await WasmInspect.destroy(props.module as any);
    });

  });
} else {
  test.skip("No WASMINSPECT_SERVER_PATH", () => {});
}
