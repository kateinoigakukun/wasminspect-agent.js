declare module "worker-loader*!./socket.worker" {
    class WebpackWorker extends Worker {
      constructor();
    }
  
    export default WebpackWorker;
  }
