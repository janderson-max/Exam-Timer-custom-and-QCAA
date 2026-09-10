"use strict";

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const host = "127.0.0.1";
const port = 4173;
const root = path.resolve(__dirname, "..");
const assets = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/timer-core.js", ["timer-core.js", "text/javascript; charset=utf-8"]],
  ["/presets.js", ["presets.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
]);

const server = http.createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = new URL(request.url, `http://${host}:${port}`).pathname;
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  const asset = assets.get(pathname);
  if (!asset) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  try {
    const [filename, contentType] = asset;
    const content = await fs.readFile(path.join(root, filename));
    response.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": content.length,
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch (error) {
    console.error("Unable to read preview asset:", error.message);
    response.writeHead(500);
    response.end("Unable to read preview asset");
  }
});

server.on("error", (error) => {
  console.error(`Unable to start local preview: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`Exam Room Timer preview: http://${host}:${port}`);
});
