import { WorkerHandle, WorkerPort } from "./worker";

export interface NodeWorker {
  postMessage(message: any, transfer?: any[]): void;
  on(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: {}
  ): void;
  off(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: {}
  ): void;
  start?: () => void;
}
export interface NodeWorkerHandle extends NodeWorker {
  terminate(): Promise<number>;
}

export function wrapNodeWorker(nep: NodeWorker): WorkerPort {
  const listeners = new WeakMap();
  return {
    postMessage: nep.postMessage.bind(nep),
    addEventListener: (name, eh) => {
      const l = (data: any) => {
        if ("handleEvent" in eh) {
          eh.handleEvent({ data } as MessageEvent);
        } else {
          eh({ data } as MessageEvent);
        }
      };
      nep.on(name, l);
      listeners.set(eh, l);
    },
    removeEventListener: (name, eh) => {
      const l = listeners.get(eh);
      if (!l) {
        return;
      }
      nep.off(name, l);
      listeners.delete(eh);
    },
  };
}

export function wrapNodeWorkerHandle(nep: NodeWorkerHandle): WorkerHandle {
  return {
    ...wrapNodeWorker(nep),
    async terminate() {
      await nep.terminate();
    },
  };
}
