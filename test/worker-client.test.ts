import { WorkerClient } from "../src/worker-client";
import { Config, defaultConfig } from "../src/config";
import { Worker } from 'worker_threads';
import * as path from "path"
import { wrapNodeWorkerHandle } from '../src/node-adapter';
import { WorkerHandle, WorkerPort } from '../src/worker';

type Variant = {
    type: "SIMPLE_ECHO"
} | {
    type: "DELAY_ECHO",
    duration: number,
}

function createSocketWorker(variant: Variant): WorkerHandle {
    const worker = new Worker(path.join(__dirname, "./mock-worker.mjs"));
    worker.postMessage(variant);
    return wrapNodeWorkerHandle(worker);
}

async function setupClient(variant: Variant) {
    const config: Config = defaultConfig();
    config.blockingTimeout = 3000;
    const client = new WorkerClient(config, () => {
        return createSocketWorker(variant);
    });
    client.postRequest({ type: "Configure", inner: config })
    await client.receive("SetConfiguration");
    await client.receive("OnSocketOpen");

    return client;
}

describe("blockingReceive", () => {
    let _client: WorkerClient | undefined;
    afterEach(async () => {
        await _client!.terminate();
    })
    it("event happen after receive", async () => {
        const client = await setupClient({ type: "DELAY_ECHO", duration: 10 });
        _client = client;
        client.postRequest({
            type: "SocketRequest", inner: {
                type: "TextRequest",
                body: "Hello"
            }
        }, true);
        const response = client.blockingReceive("SocketResponse");
        expect(response.inner.body).toBe("Hello")
    })

    it("event happen before receive", async (done) => {
        const client = await setupClient({ type: "SIMPLE_ECHO" });
        _client = client;
        client.postRequest({
            type: "SocketRequest", inner: {
                type: "TextRequest",
                body: "Hello"
            }
        }, true);
        setTimeout(() => {
            const response = client.blockingReceive("SocketResponse");
            expect(response.inner.body).toBe("Hello")
            done()
        }, 100);
    })
})

describe("receive", () => {
    let _client: WorkerClient | undefined;
    afterEach(async () => {
        await _client!.terminate();
    })
    it("event happen after receive", async () => {
        const client = await setupClient({ type: "DELAY_ECHO", duration: 10 });
        _client = client;
        client.postRequest({
            type: "SocketRequest", inner: {
                type: "TextRequest",
                body: "Hello"
            }
        });
        const response = await client.receive("SocketResponse");
        expect(response.inner.body).toBe("Hello")
    })

    it("event happen before receive", async (done) => {
        const client = await setupClient({ type: "SIMPLE_ECHO" });
        _client = client;
        client.postRequest({
            type: "SocketRequest", inner: {
                type: "TextRequest",
                body: "Hello"
            }
        });
        setTimeout(() => {
            client.receive("SocketResponse").then((response) => {
                expect(response.inner.body).toBe("Hello")
                done()
            });
        }, 100);
    })
})
