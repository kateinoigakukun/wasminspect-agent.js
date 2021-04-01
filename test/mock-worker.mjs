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
    constructor(variant) {
        this.onmessage = () => { };
        this.onopen = () => { };
        this.variant = variant;
        queueMicrotask(() => {
            this.onopen({})
        })
    }
    send(data) {
        switch (variant.type) {
            case "SIMPLE_ECHO": {
                this.onmessage({ data })
            }
            case "DELAY_ECHO": {
                setTimeout(() => {
                    this.onmessage({ data })
                }, variant.duration);
            }
        }
    }
}

const ctx = getContext();
let variant = undefined;

ctx.addEventListener("message", (event) => {
    if (!variant) {
        variant = event.data;
        return;
    }
    const workerRequest = event.data;
    acceptWorkerRequest(workerRequest, state, ctx, () => {
        return new EchoSocket(variant);
    });
})
