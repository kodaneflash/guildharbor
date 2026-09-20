import nextEnv from "@next/env";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

nextEnv.loadEnvConfig(process.cwd());

async function availablePort() {
  const probe = net.createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address();
  if (!address || typeof address === "string") throw new Error("Unable to allocate a local acceptance port");
  const port = address.port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

const directory = await mkdtemp(join(tmpdir(), "guildharbor-https-"));
const applicationPort = await availablePort();
const proxyPort = await availablePort();
const secureOrigin = `https://localhost:${proxyPort}`;
const env = { ...process.env, BETTER_AUTH_URL: secureOrigin, NEXT_PUBLIC_APP_URL: secureOrigin, PLAYWRIGHT_BASE_URL: secureOrigin, PLAYWRIGHT_LOCAL_HTTPS: "1" };
const children = new Set();
function run(args) {
  const child = spawn(args[0], args.slice(1), { env, stdio: "inherit" });
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}
async function successful(args) {
  const [code] = await once(run(args), "exit");
  if (code !== 0) throw new Error(`${args[0]} failed (${code})`);
}
const proxy = https.createServer();
async function cleanup() {
  proxy.closeAllConnections();
  if (proxy.listening) await new Promise(resolve => proxy.close(resolve));
  for (const child of children) child.kill("SIGTERM");
  await Promise.all([...children].map(child => once(child, "exit")));
  await rm(directory, { recursive: true, force: true });
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void cleanup().then(() => process.exit(1)); });
try {
  await successful(["bun", "run", "build"]);
  await successful(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1", "-keyout", join(directory, "key.pem"), "-out", join(directory, "cert.pem")]);
  proxy.setSecureContext({ key: await readFile(join(directory, "key.pem")), cert: await readFile(join(directory, "cert.pem")) });
  proxy.on("request", (request, response) => {
    const upstream = http.request({ hostname: "127.0.0.1", port: applicationPort, path: request.url, method: request.method, headers: { ...request.headers, "x-forwarded-proto": "https", "x-forwarded-host": request.headers.host } }, incoming => {
      response.writeHead(incoming.statusCode ?? 502, incoming.headers);
      incoming.pipe(response);
    });
    upstream.on("error", () => { response.writeHead(502); response.end("Upstream unavailable"); });
    request.on("aborted", () => upstream.destroy());
    request.pipe(upstream);
  });
  const server = run(["bun", "run", "start", "--hostname", "127.0.0.1", "--port", String(applicationPort)]);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error("Production server exited before readiness");
    ready = await new Promise(resolve => { const probe = http.get(`http://127.0.0.1:${applicationPort}/sign-in`, response => { response.resume(); resolve(response.statusCode === 200); }); probe.on("error", () => resolve(false)); probe.setTimeout(1000, () => probe.destroy()); });
    if (ready) break;
    await delay(200);
  }
  if (!ready) throw new Error("Production server readiness timeout");
  proxy.listen(proxyPort, "localhost");
  await once(proxy, "listening");
  await successful(["bun", "run", "test:e2e"]);
} finally { await cleanup(); }
