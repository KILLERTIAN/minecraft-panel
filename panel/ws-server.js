// WebSocket console: streams live Minecraft container logs to authed clients.
// Attached to the same HTTP server as Next (path: /ws).
const { WebSocketServer } = require("ws");
const Docker = require("dockerode");
const { jwtVerify } = require("jose");

const docker = new Docker({ socketPath: "/var/run/docker.sock" });
const MC = process.env.MC_CONTAINER || "mc";
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-insecure-secret-change-me"
);
const COOKIE = "mcpanel_session";

function parseCookie(header, name) {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}

async function authed(req) {
  const token = parseCookie(req.headers.cookie, COOKIE);
  if (!token) return false;
  try {
    await jwtVerify(token, SECRET, { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

// Demux Docker's 8-byte framed log stream into clean lines.
function makeDemuxer(onLine) {
  let buf = Buffer.alloc(0);
  let textBuf = "";
  return (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    // Process complete frames.
    while (buf.length >= 8) {
      const type = buf[0];
      const framed =
        (type === 0 || type === 1 || type === 2) &&
        buf[1] === 0 &&
        buf[2] === 0 &&
        buf[3] === 0;
      if (!framed) {
        // TTY / unframed: treat all as text.
        textBuf += buf.toString("utf8");
        buf = Buffer.alloc(0);
        break;
      }
      const len = buf.readUInt32BE(4);
      if (buf.length < 8 + len) break; // wait for full frame
      textBuf += buf.subarray(8, 8 + len).toString("utf8");
      buf = buf.subarray(8 + len);
    }
    let idx;
    while ((idx = textBuf.indexOf("\n")) >= 0) {
      const line = textBuf.slice(0, idx).replace(/\r$/, "");
      textBuf = textBuf.slice(idx + 1);
      if (line.length) onLine(line);
    }
  };
}

function attachWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set();
  const ring = []; // last N lines buffer for new clients
  const RING_MAX = 200;

  let logStream = null;
  let reconnectTimer = null;

  function broadcast(line) {
    ring.push(line);
    if (ring.length > RING_MAX) ring.shift();
    const payload = JSON.stringify({ type: "console", line });
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    }
  }

  async function startLogStream() {
    cleanupStream();
    try {
      const container = docker.getContainer(MC);
      const stream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        tail: 80,
        timestamps: false,
      });
      logStream = stream;
      const demux = makeDemuxer(broadcast);
      stream.on("data", demux);
      stream.on("end", scheduleReconnect);
      stream.on("error", scheduleReconnect);
    } catch {
      scheduleReconnect();
    }
  }

  function cleanupStream() {
    if (logStream) {
      try {
        logStream.destroy();
      } catch {}
      logStream = null;
    }
  }

  function scheduleReconnect() {
    cleanupStream();
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (clients.size > 0) startLogStream();
    }, 3000);
  }

  server.on("upgrade", async (req, socket, head) => {
    const { url } = req;
    if (!url || !url.startsWith("/ws")) return; // let Next HMR sockets pass
    if (!(await authed(req))) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws) => {
    clients.add(ws);
    // Replay recent buffer.
    if (ring.length) {
      ws.send(JSON.stringify({ type: "history", lines: ring.slice() }));
    }
    if (clients.size === 1 && !logStream) startLogStream();

    ws.on("close", () => {
      clients.delete(ws);
      if (clients.size === 0) cleanupStream();
    });
    ws.on("error", () => {
      clients.delete(ws);
    });
  });

  console.log("> WebSocket console attached on /ws");
}

module.exports = { attachWebSocket };
