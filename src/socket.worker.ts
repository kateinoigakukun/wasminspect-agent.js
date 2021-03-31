import { Request } from "./rpc"
import WS from "./websocket-constructor"
import getContext from "./worker-context-constructor"

const ctx = getContext();
const ws = new WS.WebSocket("ws://127.0.0.1:4000/debugger");
ws.onopen = () => {
    ctx.postMessage({ type: "OnSocketOpen" })
}
ws.onmessage = (event: any) => {
    console.log("Receive event: ", event)
}

ctx.addEventListener("message", (event: any) => {
    const request = event.data as Request;
    switch (request.type) {
        case "TextRequest": {
            const json = JSON.stringify(request.body);
            ws.send(json);
            break;
        }
    }
})
