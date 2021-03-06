import { BlockingQueue, acceptWorkerRequest } from "../dist/socket-worker.js";
import { getContext } from "../dist/worker-context-constructor.js";

const state = {
    debugEnabled: false,
    isBlocking: false,
    socket: null,
    waitingPrologue: new BlockingQueue(),
    waitingEpilogue: new BlockingQueue(),
}

class MockSocket {
    constructor(variant) {
        this.onmessage = () => { };
        this.onopen = () => { };
        this.variant = variant;
        queueMicrotask(() => {
            this.onopen({})
        })
    }
    send(data) {
        console.log(data)
    }
}

const ctx = getContext();
let variant = undefined;

ctx.addEventListener("message", (event) => {
    const workerRequest = event.data;
    acceptWorkerRequest(workerRequest, state, ctx, () => {
        return new MockSocket(variant);
    });
})
