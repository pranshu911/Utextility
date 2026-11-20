const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png" };
const entryFiles = new Set(["index.html", "engine.js", "workbench.js", "saved-steps.js", "worker.js", "styles.css", "guide.js", "guide.css"]);

async function serve(request, response) {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === "/guide/") { response.writeHead(308, { Location: "/guide" }).end(); return; }
  const file = pathname === "/" || pathname === "/guide" ? "index.html" : pathname.slice(1);
  if (!["GET", "HEAD"].includes(request.method) || !(entryFiles.has(file) || /^assets\/[\w-]+\.(?:woff2|png)$/.test(file))) {
    response.writeHead(404).end();
    return;
  }
  try {
    const body = await fs.readFile(path.join(root, file));
    response.writeHead(200, { "Content-Type": types[path.extname(file)], "Cache-Control": "no-cache" });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(404).end();
  }
}

function listen(port) {
  const server = http.createServer(serve);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve(server);
    });
  });
}

if (require.main === module) {
  listen(Number(process.argv[2] || 4389)).then(
    server => console.log("Utextility is ready at http://127.0.0.1:" + server.address().port + "/"),
    error => { console.error(error.message); process.exitCode = 1; }
  );
}
module.exports = { listen };
