import SocketWorker from "worker-loader!./socket.worker"

export default function () { return new SocketWorker() };
