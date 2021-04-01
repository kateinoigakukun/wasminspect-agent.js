import { State, BlockingQueue, acceptWorkerRequest } from "./socket-worker";
import { getContext } from "./worker-context-constructor"
import WS from "./websocket-constructor"
import { WorkerRequest } from "./worker-rpc";

const state: State = {
    debugEnabled: false,
    isBlocking: false,
    socket: null,
    waitingPrologue: new BlockingQueue(),
    waitingEpilogue: new BlockingQueue(),
}

const ctx = getContext();
ctx.addEventListener("message", (event: any) => {
    const workerRequest = event.data as WorkerRequest & { isBlocking: boolean };
    acceptWorkerRequest(workerRequest, state, ctx, (addr) => {
        return new WS.WebSocket(addr);
    });
})
