import { WorkerClient } from "../src/worker-client";
import { Config, defaultConfig } from "../src/config";
import { Worker } from 'worker_threads';
import * as path from "path"
import { wrapNodeWorkerHandle } from '../src/node-adapter';
import { WorkerHandle, WorkerPort } from '../src/worker';

function createSocketWorker(): WorkerHandle {
    return wrapNodeWorkerHandle(new Worker(path.join(__dirname, "./mock-worker.mjs")));
}

describe("blockingReceive", () => {
    let _client: WorkerClient | undefined;
    beforeEach(async () => {
        const config: Config = defaultConfig();
        config.blockingTimeout = 3000;
        config.debugEnabled = true;
        _client = new WorkerClient(config, createSocketWorker);
        _client.postRequest({ type: "Configure", inner: config })
        await _client.receive("SetConfiguration");
        await _client.receive("OnSocketOpen");
    })
    afterEach(async () => {
        await _client!.terminate();
    })
    it("event happen before receive", async () => {
        const client = _client!;
        client.postRequest({
            type: "SocketRequest", inner: {
                type: "TextRequest",
                body: "Hello"
            }
        }, true);
        const response = client.blockingReceive("SocketResponse");
        expect(response.inner.body).toBe("Hello")
    })
})
