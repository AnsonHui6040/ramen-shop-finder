import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const docsDir = path.join(rootDir, "docs");
const port = Number(process.env.PORT || 5173);

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

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
};

function send(req, res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    ...securityHeaders,
    "Content-Type": contentType,
  });

  res.end(req.method === "HEAD" ? undefined : body);
}

function decodeUrlPath(rawUrl) {
  try {
    return decodeURIComponent((rawUrl || "/").split("?")[0]);
  } catch {
    return null;
  }
}

function isInsideDir(parentDir, targetPath) {
  const relative = path.relative(parentDir, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

const server = http.createServer((req, res) => {
  if (!["GET", "HEAD"].includes(req.method || "")) {
    send(req, res, 405, "Method Not Allowed");
    return;
  }

  const urlPath = decodeUrlPath(req.url);
  if (!urlPath) {
    send(req, res, 400, "Bad Request");
    return;
  }

  const normalized = urlPath === "/" ? "/index.html" : urlPath;
  const targetPath = path.resolve(docsDir, `.${normalized}`);

  if (!isInsideDir(docsDir, targetPath)) {
    send(req, res, 403, "Forbidden");
    return;
  }

  let finalPath = targetPath;

  try {
    if (fs.existsSync(finalPath) && fs.statSync(finalPath).isDirectory()) {
      finalPath = path.join(finalPath, "index.html");
    }

    if (!isInsideDir(docsDir, finalPath) || !fs.existsSync(finalPath)) {
      send(req, res, 404, "Not Found");
      return;
    }

    const ext = path.extname(finalPath).toLowerCase();
    const contentType = contentTypes[ext] || "application/octet-stream";
    const fileBuffer = fs.readFileSync(finalPath);
    send(req, res, 200, fileBuffer, contentType);
  } catch (error) {
    console.error(error);
    send(req, res, 500, "Internal Server Error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Preview server running at http://127.0.0.1:${port}`);
});
