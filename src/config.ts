export type Config = {
  debugEnabled: boolean;
  socketAddr: string;
  blockingTimeout: number;
};

export function defaultConfig(): Config {
  return {
    debugEnabled: false,
    socketAddr: "ws://127.0.0.1:4000/debugger",
    blockingTimeout: 30 * 1000,
  };
}
