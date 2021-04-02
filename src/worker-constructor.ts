import { Worker } from "worker_threads";
import * as path from "path";
import { wrapNodeWorkerHandle } from "./node-adapter";
import { WorkerHandle } from "./worker";
export default function (): WorkerHandle {
  return wrapNodeWorkerHandle(
    new Worker(path.join(__dirname, "./index.worker.js"))
  );
}
