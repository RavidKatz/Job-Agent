import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicDir = path.join(rootDir, "public");
const outputDir = path.join(rootDir, "outputs");
const outputPath = path.join(outputDir, "ui-preview.png");
const tempOutputPath = path.join(process.env.TEMP ?? outputDir, "job-agent-ui-preview.png");
const edgeProfileDir = path.join(process.env.TEMP ?? outputDir, "job-agent-edge-profile");
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

function serveStatic() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1:4381");
    const filePath = path.normalize(path.join(publicDir, url.pathname === "/" ? "index.html" : url.pathname));

    if (!filePath.startsWith(publicDir)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const data = await fs.readFile(filePath);
      response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] ?? "application/octet-stream" });
      response.end(data);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
}

const server = serveStatic();
await new Promise((resolve) => server.listen(4381, "127.0.0.1", resolve));

try {
  await fs.mkdir(outputDir, { recursive: true });
  await new Promise((resolve, reject) => {
    const edge = spawn(edgePath, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      `--user-data-dir=${edgeProfileDir}`,
      "--window-size=1440,1100",
      "--virtual-time-budget=1500",
      `--screenshot=${tempOutputPath}`,
      "http://127.0.0.1:4381/"
    ], { stdio: "inherit" });

    edge.on("error", reject);
    edge.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Edge screenshot failed with exit code ${code}.`));
    });
  });
  await fs.copyFile(tempOutputPath, outputPath);
  console.log(outputPath);
} finally {
  await new Promise((resolve) => server.close(resolve));
}
