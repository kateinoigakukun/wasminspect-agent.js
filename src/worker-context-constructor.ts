import { parentPort } from 'worker_threads';
import wrapNodeWorker from './node-adapter';
import { WorkerPort } from './worker';
export default function(): WorkerPort {
    return wrapNodeWorker(parentPort!);
}
