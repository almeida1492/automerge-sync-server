import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import express from "express";
import fs from "fs";
import os from "os";
import { WebSocketServer } from "ws";
import { Repo } from "@automerge/automerge-repo";

export class Server {
  #socket;
  #server;
  #readyResolvers = [];
  #isReady = false;
  #repo;

  constructor() {
    const dir = "automerge-sync-server-data";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    const hostname = os.hostname();

    this.#socket = new WebSocketServer({ noServer: true });

    const PORT = 3030;
    const app = express();
    app.use(express.static("public"));

    this.#repo = new Repo({
      network: [new NodeWSServerAdapter(this.#socket)],
      storage: new NodeFSStorageAdapter(dir),
      peerId: `storage-server-${hostname}`,
      sharePolicy: async () => false,
    });

    app.get("/", (_req, res) => {
      res.send(`🚀 sync-server is running!`);
    });

    this.#server = app.listen(PORT, () => {
      console.log(`Listening on port ${PORT}`);
      this.#isReady = true;
      this.#readyResolvers.forEach((resolve) => resolve(true));
    });

    this.#server.on("upgrade", (request, socket, head) => {
      this.#socket.handleUpgrade(request, socket, head, (socket) => {
        this.#socket.emit("connection", socket, request);
      });
    });
  }

  async ready() {
    if (this.#isReady) return true;
    return new Promise((resolve) => this.#readyResolvers.push(resolve));
  }

  close() {
    this.#socket.close();
    this.#server.close();
  }
}

new Server();
