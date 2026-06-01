import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const port = Number(process.env.PORT || 4173);
const root = resolve(process.cwd());
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    const relativePath = decodeURIComponent(url.pathname === "/" ? "index.html" : url.pathname).replace(/^\/+/, "");
    const target = resolve(root, relativePath);

    if (!target.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const body = await readFile(target);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(target)] || "application/octet-stream",
    });
    response.end(body);
  } catch (error) {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`EduRede Integrada em http://127.0.0.1:${port}`);
});
