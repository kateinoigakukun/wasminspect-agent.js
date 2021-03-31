import { Worker } from 'worker_threads';
import * as path from "path"
import wrapNodeWorker from './node-adapter';
import { WorkerPort } from './worker';
export default function(): WorkerPort {
    return wrapNodeWorker(new Worker(path.join(__dirname, "./socket.worker.js")));
}
