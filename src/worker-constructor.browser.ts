import SocketWorker from "worker-loader?inline=fallback!./socket.worker"

export default function () { return new SocketWorker() };
