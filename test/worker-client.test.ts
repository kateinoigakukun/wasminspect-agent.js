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
    it("", async () => {
        const config: Config = defaultConfig();
        const client = new WorkerClient(config, createSocketWorker);
        await client.terminate()
    })
})
