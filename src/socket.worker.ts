import { SocketRequest, TextResponse } from "./socket-rpc"
import WS from "./websocket-constructor"
import getContext from "./worker-context-constructor"
import { WorkerRequest, WorkerResponse } from "./worker-rpc";

const ctx = getContext();
let debugEnabled: boolean = false;

class Socket {
    ws: typeof WS.WebSocket["prototype"];

    constructor(addr: string) {
        const ws = new WS.WebSocket(addr);
        this.ws = ws;
        ws.onopen = () => {
            ctx.postMessage({ type: "OnSocketOpen" } as WorkerResponse)
        }
        ws.onmessage = (event: any) => {
            if (debugEnabled) {
                console.log("[wasminspect-web] [main thread] <- [worker thread] <- [socket] ", event.data)
            }
            if (typeof event.data === "string") {
                const body = JSON.parse(event.data) as TextResponse;
                ctx.postMessage({ type: "SocketResponse", inner: { type: "TextResponse", body } } as WorkerResponse)
            }
        }
    }
}

let socket: Socket | null = null;

ctx.addEventListener("message", (event: any) => {
    const workerRequest = event.data as WorkerRequest;
    switch (workerRequest.type) {
        case "Configure": {
            socket = new Socket(workerRequest.socketAddr);
            debugEnabled = workerRequest.debugEnabled;
            break;
        }
        case "SocketRequest": {
            const request = workerRequest.inner;
            console.log("[wasminspect-web] [main thread] -> [worker thread] -> [socket] ", JSON.stringify(request))
            switch (request.type) {
                case "TextRequest": {
                    const json = JSON.stringify(request.body);
                    socket.ws.send(json);
                    break;
                }
                case "BinaryRequest": {
                    socket.ws.send(request.body);
                }
            }
            break;
        }
    }
})
