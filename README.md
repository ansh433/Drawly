# Drawly

> Built a real-time collaborative whiteboard with chat and persisted rooms.

Drawly is a collaborative drawing app where users can create rooms, draw shapes on a shared canvas, and chat with other people in the same room. It supports account signup/signin, room creation/joining, real-time drawing updates over WebSockets, and persisted canvas/chat history through PostgreSQL.

It gives small teams, students, or collaborators a browser-based space to sketch ideas together without needing a heavyweight design tool. The app combines drawing and room chat so discussion and visual work happen in the same place.

---

## Features

- **Room-based collaboration** — Create or join rooms with a unique ID
- **Real-time drawing** — Draw rectangles, circles, and freehand strokes with live sync
- **Shape styling** — Customize fill, stroke color, and stroke width
- **Shape manipulation** — Select, move, restyle, and delete shapes
- **Integrated chat** — Room chat with optimistic sending, message history, and sender attribution
- **Persistent canvas** — Shapes and chat messages survive page refreshes
- **JWT authentication** — Secure signup/signin with password validation
- **Pan & zoom** — Navigate large canvases with mouse/touch controls

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| **Canvas Engine** | Custom imperative HTML5 Canvas engine |
| **HTTP Backend** | Express 5, Node.js, TypeScript |
| **WebSocket Backend** | `ws` library, Node.js |
| **Database** | PostgreSQL (JSONB for shape data) |
| **ORM** | Prisma 7 |
| **Validation** | Zod (shared across frontend & backend) |
| **Auth** | JWT, bcrypt |
| **Monorepo** | pnpm workspaces, Turbo |
| **Deployment** | Vercel (frontend), Render (backends) |

---

**Data Flow:**

1. Users sign up/sign in via HTTP API → receive JWT → stored in `localStorage`
2. Frontend opens WebSocket with `?token=<jwt>` and sends `join_room`
3. Canvas loads existing shapes via `GET /shapes/:roomId`
4. Drawing events (`shape:create`, `shape:update`, `shape:delete`) are sent over WebSocket
5. Backend validates, persists to PostgreSQL, and broadcasts to all room members
6. Chat uses optimistic UI with `clientMessageId` reconciliation


---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- PostgreSQL database
- pnpm

### Installation

```bash
pnpm install
```

### Environment Variables

**`apps/http-backend/.env`**
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/drawly"
JWT_SECRET="your-secret-key"
PORT=3002
```

**`apps/ws-backend/.env`**
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/drawly"
JWT_SECRET="your-secret-key"
PORT=8080
```

**`apps/frontend/.env`**
```env
NEXT_PUBLIC_HTTP_BACKEND="http://localhost:3002"
NEXT_PUBLIC_WS_BACKEND="ws://localhost:8080"
```

### Database Setup

```bash
pnpm --filter @repo/db exec prisma migrate deploy
pnpm --filter @repo/db exec prisma generate
```

### Development

```bash
# Run all apps
pnpm dev

# Or run individually
pnpm --filter frontend dev
pnpm --filter http-backend dev
pnpm --filter ws-backend dev
```

### Build

```bash
pnpm build
```


---

## API Overview

### HTTP Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/signup` | Create account |
| `POST` | `/signin` | Authenticate |
| `GET` | `/me` | Current user |
| `POST` | `/room` | Create room |
| `GET` | `/rooms` | List rooms |
| `GET` | `/room/:slug` | Get room by slug |
| `GET` | `/chats/:roomId` | Chat history (max 1000) |
| `GET` | `/shapes/:roomId` | Shape history |

### WebSocket Events

| Event | Direction | Description |
|---|---|---|
| `join_room` | Client → Server | Join a room |
| `shape:create` | Client → Server | Create a new shape |
| `shape:update` | Client → Server | Update existing shape |
| `shape:delete` | Client → Server | Delete a shape |
| `chat:send` | Client → Server | Send chat message |
| `shape:created` | Server → Client | Broadcast new shape |
| `shape:updated` | Server → Client | Broadcast shape update |
| `shape:deleted` | Server → Client | Broadcast shape deletion |
| `chat:message` | Server → Client | Broadcast chat message |
