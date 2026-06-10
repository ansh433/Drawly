# ExcaliDraw

ExcaliDraw is a collaborative whiteboard monorepo. The primary app, `apps/frontend`, is a Next.js canvas experience where users can sign up, create or join rooms, draw shapes in real time, and reload persisted drawings from the database.

## Tech Stack

- **Frontend:** Next.js, React, Tailwind CSS, Radix UI, Framer Motion
- **HTTP API:** Express, JWT auth, bcrypt, Prisma
- **Realtime:** WebSocket server with `ws`
- **Database:** PostgreSQL via Prisma
- **Workspace:** pnpm workspaces and Turborepo

## Project Structure

```txt
apps/
  frontend/      Main Drawly/ExcaliDraw web app
  http-backend/  Express API for auth, rooms, and persisted canvas messages
  ws-backend/    WebSocket server for realtime room updates
  web/           Secondary Next.js app in the workspace
packages/
  db/            Prisma schema, migrations, generated client, and DB exports
  common/        Shared Zod validation schemas
  backend-common/Shared backend constants
  ui/            Shared React UI primitives
```

## Prerequisites

- Node.js 20 or newer
- pnpm 9
- PostgreSQL database

## Setup

Install dependencies:

```sh
pnpm install
```

Set the database URL in your shell before running backend or Prisma commands:

```sh
export DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/excalidraw"
```

The frontend defaults to the local backend URLs below:

```sh
NEXT_PUBLIC_HTTP_BACKEND=http://localhost:3002
NEXT_PUBLIC_WS_URL=ws://localhost:8080
```

You only need to set those frontend variables if your backend runs somewhere else. The HTTP backend also accepts `FRONTEND_URL` for an additional allowed CORS origin.

Generate the Prisma client and build the database package:

```sh
pnpm --filter @repo/db build
```

Run database migrations from the database package:

```sh
pnpm --filter @repo/db exec prisma migrate deploy
```

## Development

Run the main services in separate terminals:

```sh
pnpm --filter @repo/db build
pnpm --filter http-backend dev
pnpm --filter ws-backend dev
pnpm --filter frontend dev
```

Default local ports:

- Frontend: `http://localhost:3000`
- HTTP backend: `http://localhost:3002`
- WebSocket backend: `ws://localhost:8080`

You can also run all workspace dev tasks through Turborepo:

```sh
pnpm dev
```

## Useful Commands

```sh
pnpm build        # Build all apps and packages through Turborepo
pnpm lint         # Run workspace lint tasks
pnpm check-types  # Run workspace type checks
pnpm format       # Format TS, TSX, and Markdown files
```

## API Overview

The HTTP backend exposes:

- `POST /signup` - create a user and return a JWT
- `POST /signin` - authenticate and return a JWT
- `POST /room` - create a room for the authenticated user
- `GET /rooms` - list rooms owned by the authenticated user
- `GET /room/:slug` - look up a room by slug
- `GET /chats/:roomId` - fetch persisted canvas messages for a room

The WebSocket backend expects a JWT query parameter:

```txt
ws://localhost:8080?token=<jwt>
```

Clients send `join_room`, `leave_room`, and `chat` messages. Canvas shapes are persisted as chat messages and replayed when a room is reopened.
