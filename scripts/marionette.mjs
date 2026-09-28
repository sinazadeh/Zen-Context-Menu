// A minimal client for Marionette, the automation protocol built into
// Firefox and Zen (https://firefox-source-docs.mozilla.org/testing/marionette/Protocol.html).
// Enough to run scripts in the browser's own (chrome) context.

import { connect } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

export class Marionette {
  #socket;
  #buffer = Buffer.alloc(0);
  #nextId = 1;
  #pending = new Map();
  #hello;

  /**
   * @param {number} port
   * @param {number} timeoutMs how long to wait for the browser to listen
   * @returns {Promise<Marionette>}
   */
  static async connect(port, timeoutMs = 60000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const client = new Marionette();
      try {
        await client.#open(port);
        return client;
      } catch (error) {
        if (Date.now() > deadline) throw error;
        await sleep(500);
      }
    }
  }

  #open(port) {
    return new Promise((resolve, reject) => {
      this.#hello = { resolve, reject };
      this.#socket = connect(port, "127.0.0.1");
      this.#socket.on("data", (data) => this.#onData(data));
      this.#socket.on("error", (error) => {
        this.#hello?.reject(error);
        for (const { reject: rejectPending } of this.#pending.values()) {
          rejectPending(error);
        }
      });
    });
  }

  #onData(data) {
    this.#buffer = Buffer.concat([this.#buffer, data]);
    for (;;) {
      const colon = this.#buffer.indexOf(":");
      if (colon < 0) return;
      const length = Number(this.#buffer.subarray(0, colon).toString());
      if (this.#buffer.length < colon + 1 + length) return;
      const message = JSON.parse(
        this.#buffer.subarray(colon + 1, colon + 1 + length).toString(),
      );
      this.#buffer = this.#buffer.subarray(colon + 1 + length);
      if (this.#hello) {
        // The first message is the server's greeting.
        this.#hello.resolve();
        this.#hello = null;
        continue;
      }
      const [, id, error, result] = message;
      const pending = this.#pending.get(id);
      this.#pending.delete(id);
      if (error) {
        pending?.reject(new Error(`${error.error}: ${error.message}`));
      } else {
        pending?.resolve(result);
      }
    }
  }

  /**
   * @param {string} command
   * @param {object} [params]
   * @returns {Promise<any>}
   */
  send(command, params = {}) {
    const id = this.#nextId++;
    const data = Buffer.from(JSON.stringify([0, id, command, params]));
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#socket.write(`${data.length}:`);
      this.#socket.write(data);
    });
  }

  /** Starts a session and switches to the browser's chrome context. */
  async start() {
    await this.send("WebDriver:NewSession", { capabilities: {} });
    await this.send("Marionette:SetContext", { value: "chrome" });
  }

  /**
   * Runs a script; it gets `args` as `arguments` and its return value (or,
   * with async, the value passed to its last argument) comes back.
   *
   * @param {string} script
   * @param {Array<any>} [args]
   * @param {{ async?: boolean, timeoutMs?: number }} [options]
   */
  async run(script, args = [], { async = false, timeoutMs = 30000 } = {}) {
    const command = async
      ? "WebDriver:ExecuteAsyncScript"
      : "WebDriver:ExecuteScript";
    const result = await this.send(command, {
      script,
      args,
      scriptTimeout: timeoutMs,
    });
    return result?.value;
  }

  async quit() {
    try {
      await this.send("Marionette:Quit", { flags: ["eForceQuit"] });
    } catch {
      // The browser may close the connection before answering.
    }
    this.#socket.destroy();
  }
}
