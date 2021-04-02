import { parentPort } from "worker_threads";
import { wrapNodeWorker } from "./node-adapter";
import { WorkerPort } from "./worker";
export function getContext(): WorkerPort {
  return wrapNodeWorker(parentPort!);
}
