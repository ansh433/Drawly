#!/usr/bin/env node

import { performance } from "node:perf_hooks";

const HTTP_URL = envString("HTTP_URL", "http://localhost:3002").replace(/\/$/, "");
const DURATION_MS = envInt("DURATION_MS", 10_000);
const CONCURRENCY = envInt("CONCURRENCY", 20);
const WARMUP_MS = envInt("WARMUP_MS", 1_000);
const TIMEOUT_MS = envInt("TIMEOUT_MS", 10_000);

function envString(name, fallback) {
  return process.env[name] || fallback;
}

function envInt(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function percentile(sorted, pct) {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
}

function summarize(name, samples, errors, durationMs) {
  const sorted = [...samples].sort((a, b) => a - b);
  const total = samples.length + errors;
  return {
    name,
    requests: samples.length,
    errors,
    total,
    rps: Number((total / (durationMs / 1000)).toFixed(2)),
    p50Ms: Number(percentile(sorted, 50).toFixed(2)),
    p95Ms: Number(percentile(sorted, 95).toFixed(2)),
    p99Ms: Number(percentile(sorted, 99).toFixed(2)),
    maxMs: Number((sorted.at(-1) || 0).toFixed(2)),
  };
}

async function timedFetch(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = performance.now();

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
    const duration = performance.now() - started;
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 160)}`);
    }
    return { duration, text };
  } finally {
    clearTimeout(timeout);
  }
}

async function jsonFetch(path, options = {}) {
  const result = await timedFetch(path, options);
  return JSON.parse(result.text);
}

async function ensureBenchContext() {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const username = `b${suffix}`.slice(0, 20);
  const password = `bench-${suffix}`;
  const name = "Benchmark User";

  let token;
  try {
    const signup = await jsonFetch("/signup", {
      method: "POST",
      body: JSON.stringify({ username, password, name }),
    });
    token = signup.token;
  } catch {
    const signin = await jsonFetch("/signin", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    token = signin.token;
  }

  const room = await jsonFetch("/room", {
    method: "POST",
    headers: { authorization: token },
    body: JSON.stringify({ name: `bench-${Date.now().toString(36)}`.slice(0, 20) }),
  });

  return { token, roomId: room.roomId, roomSlug: room.slug };
}

async function runLoad(name, requestFactory) {
  const latencies = [];
  let errors = 0;
  let stop = false;

  const worker = async () => {
    while (!stop) {
      const started = performance.now();
      try {
        await requestFactory();
        latencies.push(performance.now() - started);
      } catch {
        errors += 1;
      }
    }
  };

  if (WARMUP_MS > 0) {
    const warmupStopAt = performance.now() + WARMUP_MS;
    while (performance.now() < warmupStopAt) {
      try {
        await requestFactory();
      } catch {
        // Ignore warmup errors; the measured run reports real errors.
      }
    }
  }

  const started = performance.now();
  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await new Promise((resolve) => setTimeout(resolve, DURATION_MS));
  stop = true;
  await Promise.all(workers);

  return summarize(name, latencies, errors, performance.now() - started);
}

async function main() {
  console.log("HTTP benchmark starting");
  console.log(JSON.stringify({ HTTP_URL, DURATION_MS, CONCURRENCY, WARMUP_MS }, null, 2));

  const context = await ensureBenchContext();

  const benchmarks = [
    {
      name: "GET /rooms",
      request: () => timedFetch("/rooms", { headers: { authorization: context.token } }),
    },
    {
      name: "GET /chats/:roomId",
      request: () => timedFetch(`/chats/${context.roomId}`),
    },
    {
      name: "POST /room",
      request: () =>
        timedFetch("/room", {
          method: "POST",
          headers: { authorization: context.token },
          body: JSON.stringify({ name: `b-${Math.random().toString(36).slice(2, 12)}` }),
        }),
    },
  ];

  const results = [];
  for (const benchmark of benchmarks) {
    console.log(`\nRunning ${benchmark.name}...`);
    results.push(await runLoad(benchmark.name, benchmark.request));
  }

  console.log("\nHTTP benchmark results");
  console.table(results);
}

main().catch((error) => {
  console.error("HTTP benchmark failed");
  console.error(error);
  process.exitCode = 1;
});
