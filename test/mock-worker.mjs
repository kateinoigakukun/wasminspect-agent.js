import { BlockingQueue, acceptWorkerRequest } from "../dist/socket-worker.js";
import { getContext } from "../dist/worker-context-constructor.js";

const state = {
    debugEnabled: false,
    isBlocking: false,
    socket: null,
    waitingPrologue: new BlockingQueue(),
    waitingEpilogue: new BlockingQueue(),
}

class EchoSocket {
    constructor() {
        this.onmessage = () => {};
        this.onopen = () => {};
        queueMicrotask(() => {
            this.onopen({})
        })
    }
    send(data) {
        console.log("send: ", data)
        this.onmessage(data)
    }
}

const ctx = getContext();
ctx.addEventListener("message", (event) => {
    const workerRequest = event.data;
    acceptWorkerRequest(workerRequest, state, ctx, () => {
        return new EchoSocket();
    });
})
