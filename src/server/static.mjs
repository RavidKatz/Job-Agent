import fs from "node:fs/promises";
import path from "node:path";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

export async function serveStatic(response, publicDir, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const targetPath = path.normalize(path.join(publicDir, safePath));

  if (!targetPath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(targetPath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(targetPath)] ?? "application/octet-stream"
    });
    response.end(file);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}
