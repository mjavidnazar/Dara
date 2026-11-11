import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

const rawArgs = process.argv.slice(2);
const nextArgs = [nextBin, "dev"];

let port = "3000";
let hostname = "0.0.0.0";
let hasBundler = false;

for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg === "--host" || arg === "-H" || arg === "--hostname") {
    if (i + 1 < rawArgs.length) {
      hostname = rawArgs[++i];
    }
  } else if (arg.startsWith("--host=")) {
    hostname = arg.split("=")[1];
  } else if (arg.startsWith("--hostname=")) {
    hostname = arg.split("=")[1];
  } else if (arg === "-p" || arg === "--port") {
    if (i + 1 < rawArgs.length) {
      port = rawArgs[++i];
    }
  } else if (arg.startsWith("--port=")) {
    port = arg.split("=")[1];
  } else if (arg === "--turbo" || arg === "--turbopack") {
    hasBundler = true;
    nextArgs.push("--turbopack");
  } else if (arg === "--webpack") {
    hasBundler = true;
    nextArgs.push("--webpack");
  }
}

if (!hasBundler) {
  nextArgs.push("--turbopack");
}

nextArgs.push("-p", port, "-H", hostname);

const child = spawn(process.execPath, nextArgs, {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));

