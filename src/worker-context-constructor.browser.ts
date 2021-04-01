import { WorkerPort } from "./worker";

export function getContext(): WorkerPort {
    return self;
};
