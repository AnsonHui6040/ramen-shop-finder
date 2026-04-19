import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const docsDir = path.join(rootDir, "docs");
const port = 5173;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
};

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const normalized = urlPath === "/" ? "/index.html" : urlPath;
  const targetPath = path.normalize(path.join(docsDir, normalized));

  if (!targetPath.startsWith(docsDir)) {
    send(res, 403, "Forbidden");
    return;
  }

  let finalPath = targetPath;
  if (fs.existsSync(finalPath) && fs.statSync(finalPath).isDirectory()) {
    finalPath = path.join(finalPath, "index.html");
  }

  if (!fs.existsSync(finalPath)) {
    send(res, 404, "Not Found");
    return;
  }

  const ext = path.extname(finalPath).toLowerCase();
  const contentType = contentTypes[ext] || "application/octet-stream";
  const fileBuffer = fs.readFileSync(finalPath);
  send(res, 200, fileBuffer, contentType);
});

function getLocalIp() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return null;
}

server.listen(port, "0.0.0.0", () => {
  const localIp = getLocalIp();
  console.log(`Preview server running at http://127.0.0.1:${port}`);
  if (localIp) console.log(`Network access:         http://${localIp}:${port}`);
});
