#!/usr/bin/env node

import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const require = createRequire(import.meta.url);

const HTTP_URL = envString("HTTP_URL", "http://localhost:3002").replace(/\/$/, "");
const WS_URL = envString("WS_URL", "ws://localhost:8080").replace(/\/$/, "");
const CONNECTIONS = envInt("CONNECTIONS", 50);
const MESSAGES = envInt("MESSAGES", 50);
const SENDERS = Math.min(envInt("SENDERS", 1), CONNECTIONS);
const CONNECT_BATCH_SIZE = envInt("CONNECT_BATCH_SIZE", 25);
const CONNECT_BATCH_DELAY_MS = envInt("CONNECT_BATCH_DELAY_MS", 100);
const RECEIVE_TIMEOUT_MS = envInt("RECEIVE_TIMEOUT_MS", 30_000);
const TIMEOUT_MS = envInt("TIMEOUT_MS", 10_000);

function envString(name, fallback) {
  return process.env[name] || fallback;
}

function envInt(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(sorted, pct) {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
}

function summarizeLatency(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p50Ms: Number(percentile(sorted, 50).toFixed(2)),
    p95Ms: Number(percentile(sorted, 95).toFixed(2)),
    p99Ms: Number(percentile(sorted, 99).toFixed(2)),
    maxMs: Number((sorted.at(-1) || 0).toFixed(2)),
  };
}

function loadWebSocket() {
  try {
    return require("ws");
  } catch {
    try {
      return require("../apps/ws-backend/node_modules/ws");
    } catch {
      throw new Error(
        "Unable to resolve the 'ws' package. Run with: pnpm --filter ws-backend exec node ../../benchmarks/ws-benchmark.mjs",
      );
    }
  }
}

async function timedFetch(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${HTTP_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 160)}`);
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureBenchContext() {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const username = `bw${suffix}`.slice(0, 20);
  const password = `bench-ws-${suffix}`;
  const name = "WebSocket Benchmark User";

  const signup = await timedFetch("/signup", {
    method: "POST",
    body: JSON.stringify({ username, password, name }),
  });

  const room = await timedFetch("/room", {
    method: "POST",
    headers: { authorization: signup.token },
    body: JSON.stringify({ name: `ws-${Date.now().toString(36)}`.slice(0, 20) }),
  });

  return { token: signup.token, roomId: String(room.roomId), roomSlug: room.slug };
}

async function connectClient(WebSocket, id, token, roomId, onBroadcast) {
  const started = performance.now();
  const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error(`connect timeout for client ${id}`));
    }, TIMEOUT_MS);

    ws.once("open", () => {
      clearTimeout(timeout);
      ws.send(JSON.stringify({ type: "join_room", roomId }));
      resolve();
    });

    ws.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  ws.on("message", (data) => {
    try {
      const packet = JSON.parse(data.toString());
      if (packet.type !== "chat") return;

      const parsedMessage = JSON.parse(packet.message);
      if (!parsedMessage.benchmark) return;

      onBroadcast({
        clientId: id,
        messageId: parsedMessage.benchmark.id,
        sentAt: parsedMessage.benchmark.sentAt,
        receivedAt: performance.now(),
      });
    } catch {
      // Ignore messages that are not benchmark payloads.
    }
  });

  return {
    id,
    ws,
    connectMs: performance.now() - started,
  };
}

async function main() {
  const WebSocket = loadWebSocket();

  console.log("WebSocket benchmark starting");
  console.log(
    JSON.stringify(
      {
        HTTP_URL,
        WS_URL,
        CONNECTIONS,
        MESSAGES,
        SENDERS,
        CONNECT_BATCH_SIZE,
        CONNECT_BATCH_DELAY_MS,
      },
      null,
      2,
    ),
  );

  const context = await ensureBenchContext();
  const broadcasts = [];
  const clients = [];
  let connectionFailures = 0;

  const onBroadcast = (event) => broadcasts.push(event);

  console.log("\nConnecting clients...");
  for (let index = 0; index < CONNECTIONS; index += CONNECT_BATCH_SIZE) {
    const batch = Array.from({ length: Math.min(CONNECT_BATCH_SIZE, CONNECTIONS - index) }, (_, offset) => {
      const id = index + offset;
      return connectClient(WebSocket, id, context.token, context.roomId, onBroadcast)
        .then((client) => clients.push(client))
        .catch(() => {
          connectionFailures += 1;
        });
    });
    await Promise.all(batch);
    if (index + CONNECT_BATCH_SIZE < CONNECTIONS) {
      await sleep(CONNECT_BATCH_DELAY_MS);
    }
  }

  const connectLatencies = clients.map((client) => client.connectMs);
  console.log(`Connected ${clients.length}/${CONNECTIONS} clients`);

  if (clients.length === 0) {
    throw new Error("No clients connected; aborting broadcast benchmark.");
  }

  await sleep(500);

  console.log("\nSending benchmark messages...");
  const sendStarted = performance.now();
  const senderClients = clients.slice(0, SENDERS);
  let sentMessages = 0;

  for (let index = 0; index < MESSAGES; index += 1) {
    const sender = senderClients[index % senderClients.length];
    const payload = {
      type: "chat",
      roomId: context.roomId,
      message: JSON.stringify({
        shape: {
          type: "rect",
          x: index % 500,
          y: index % 300,
          width: 30,
          height: 20,
        },
        benchmark: {
          id: `msg-${index}`,
          sentAt: performance.now(),
        },
      }),
    };
    sender.ws.send(JSON.stringify(payload));
    sentMessages += 1;
  }

  const expectedBroadcasts = sentMessages * clients.length;
  const receiveDeadline = performance.now() + RECEIVE_TIMEOUT_MS;

  while (broadcasts.length < expectedBroadcasts && performance.now() < receiveDeadline) {
    await sleep(100);
  }

  const elapsedMs = performance.now() - sendStarted;
  const broadcastLatencies = broadcasts.map((event) => event.receivedAt - event.sentAt);

  for (const client of clients) {
    client.ws.close();
  }

  await sleep(250);

  const memory = process.memoryUsage();
  const results = {
    connectionTarget: CONNECTIONS,
    connected: clients.length,
    connectionFailures,
    connectionLatency: summarizeLatency(connectLatencies),
    sentMessages,
    expectedBroadcasts,
    receivedBroadcasts: broadcasts.length,
    missingBroadcasts: Math.max(expectedBroadcasts - broadcasts.length, 0),
    broadcastMessagesPerSecond: Number((broadcasts.length / (elapsedMs / 1000)).toFixed(2)),
    broadcastLatency: summarizeLatency(broadcastLatencies),
    processRssMb: Number((memory.rss / 1024 / 1024).toFixed(2)),
    processHeapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
  };

  console.log("\nWebSocket benchmark results");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error("WebSocket benchmark failed");
  console.error(error);
  process.exitCode = 1;
});
