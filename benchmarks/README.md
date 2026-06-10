# ExcaliDraw Benchmarks

Local benchmark harness for the ExcaliDraw HTTP and WebSocket backends.

These scripts are intentionally dependency-light:

- HTTP benchmarks use Node 20+ built-in `fetch`.
- WebSocket benchmarks use the repo's existing `ws` dependency from `apps/ws-backend`.

They do not run automatically. Start the app services first, then run the scripts manually.

## Required Services

In separate terminals:

```bash
pnpm --filter http-backend dev
pnpm --filter ws-backend dev
```

Make sure both services point at a disposable/local database. The benchmark creates test users, rooms, and drawing messages.

## HTTP Throughput Benchmark

```bash
node benchmarks/http-benchmark.mjs
```

Useful options:

```bash
HTTP_URL=http://localhost:3002 \
DURATION_MS=15000 \
CONCURRENCY=25 \
node benchmarks/http-benchmark.mjs
```

Default benchmark targets:

- `GET /rooms`
- `GET /chats/:roomId`
- `POST /room`

Output includes request count, requests/sec, error count, and latency percentiles.

## WebSocket Concurrency + Broadcast Benchmark

Run with the `ws-backend` workspace context so the existing `ws` dependency resolves:

```bash
pnpm --filter ws-backend exec node ../../benchmarks/ws-benchmark.mjs
```

Useful options:

```bash
HTTP_URL=http://localhost:3002 \
WS_URL=ws://localhost:8080 \
CONNECTIONS=100 \
MESSAGES=100 \
SENDERS=1 \
CONNECT_BATCH_SIZE=25 \
CONNECT_BATCH_DELAY_MS=100 \
pnpm --filter ws-backend exec node ../../benchmarks/ws-benchmark.mjs
```

What it measures:

- connection success/failure
- connection setup latency
- room join and broadcast behavior
- expected vs received broadcast messages
- broadcast latency percentiles
- process memory after the run

## Good First Runs

Start small:

```bash
CONNECTIONS=25 MESSAGES=25 pnpm --filter ws-backend exec node ../../benchmarks/ws-benchmark.mjs
```

Then increase gradually:

```bash
CONNECTIONS=100 MESSAGES=100 pnpm --filter ws-backend exec node ../../benchmarks/ws-benchmark.mjs
CONNECTIONS=250 MESSAGES=100 pnpm --filter ws-backend exec node ../../benchmarks/ws-benchmark.mjs
CONNECTIONS=500 MESSAGES=50 pnpm --filter ws-backend exec node ../../benchmarks/ws-benchmark.mjs
```

## Notes

- The current WebSocket server persists every drawing event to the database before broadcasting, so database write speed may become the bottleneck before raw socket fanout.
- WebSocket broadcasts are room-scoped. The script connects all clients to the same room to measure fanout pressure.
- The HTTP middleware expects the raw JWT in the `authorization` header, so these scripts send the token without a `Bearer` prefix.
