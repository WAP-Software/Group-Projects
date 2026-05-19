#!/usr/bin/env node
// Y.js WebSocket server for collaborative document editing
// Usage: node server.js
// Or: PORT=1234 node server.js

const { WebSocketServer } = require("ws");
const http = require("http");
const { setupWSConnection } = require("y-websocket/bin/utils");

const PORT = parseInt(process.env.PORT ?? "1234", 10);
const HOST = process.env.HOST ?? "localhost";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Y.js WebSocket Server — FinanceCollab\n");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  console.log(`[${new Date().toISOString()}] Client connected: ${req.url}`);
  setupWSConnection(ws, req);
  ws.on("close", () => {
    console.log(`[${new Date().toISOString()}] Client disconnected`);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Y.js WebSocket server running at ws://${HOST}:${PORT}`);
  console.log("Set NEXT_PUBLIC_YJS_WS_URL=ws://" + HOST + ":" + PORT + " in .env.local");
});
