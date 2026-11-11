import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "dist");
const PORT = Number(process.env.PORT || 4173);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

if (!fs.existsSync(ROOT)) {
  console.error("dist/ नहीं है। पहले `npm run build` चलाएँ।");
  process.exit(1);
}

http.createServer((req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    let file = path.join(ROOT, pathname);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403); res.end("Forbidden"); return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) {
      const notFound = path.join(ROOT, "404.html");
      res.writeHead(404, { "Content-Type": MIME[".html"] });
      res.end(fs.readFileSync(notFound));
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
    });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    res.writeHead(500); res.end("Server error");
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`सुजनी स्थानीय सर्वर: http://127.0.0.1:${PORT}`);
});
