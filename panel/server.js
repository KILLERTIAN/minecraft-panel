// Custom Next.js server that also hosts the WebSocket endpoint on the same port.
// WS handles live console streaming + status push. Everything else -> Next.
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Attach WebSocket server (live console / status). Lazy-require so the
  // build step never pulls native deps it doesn't need.
  const { attachWebSocket } = require("./ws-server");
  attachWebSocket(server);

  server.listen(port, hostname, () => {
    console.log(`> Panel ready on http://${hostname}:${port}`);
  });
});
