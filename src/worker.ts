export interface WorkerPort {
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: {}
  ): void;

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: {}
  ): void;

  postMessage(message: any, transfer?: Transferable[]): void;
}

export interface WorkerHandle extends WorkerPort {
  terminate(): Promise<void>;
}
