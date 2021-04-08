const { WasmInspect } = require("wasminspect-agent.js");

(async () => {
  const response = await fetch("/fib.wasm");
  const responseArrayBuffer = await response.arrayBuffer();
  const wasmBytes = new Uint8Array(responseArrayBuffer).buffer;

  /// Prepare for debugger
  WasmInspect.init(window);
  WasmInspect.configuration.blockingTimeout = 5 * 60 * 1000;

  const outputDiv = document.getElementById("output");
  const { instance } = await WebAssembly.instantiate(wasmBytes, {
    js_env: {
      print: (n) => {
        outputDiv.innerText += n + "\n";
        console.log(n);
      }
    }
  });
  instance.exports.fib(4)
})()
