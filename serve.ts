// serve.ts — a tiny static server for playtesting Surya Bay locally.
// Serves game/ at http://localhost:8080 (or $PORT). No dependencies.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "game");
const port = parseInt(process.env.PORT || "8080", 10);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

const server = createServer(async (req, res) => {
  try {
    const path = normalize("/" + (req.url || "/").split("?")[0]);
    const file = join(root, path === "/" ? "index.html" : path);
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch (err) {
    res.writeHead(404);
    res.end("not found");
  }
});

server.listen(port, () => {
  console.log("Surya Bay at http://localhost:" + port);
});
