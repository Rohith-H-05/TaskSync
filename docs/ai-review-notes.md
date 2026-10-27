# AI-vs-Reality Engineering Review Log

This document records architectural critiques, edge cases, bugs, or design oversights caught during the design and implementation of TaskSync, along with their resolutions.

---

## Log Entries

### Entry 001: Fractional Positioning Precision Decay (Phase 0 Design Review)
- **Component**: Task & Column Reordering (`MoveTaskInput`, `MoveColumnInput`)
- **Initial Assumption**: Using simple midpoint formula `pos = (posA + posB) / 2` with standard floating-point numbers indefinitely.
- **Problem Identified**: IEEE-754 64-bit float precision has 53 bits of significand. If a user repeatedly drags cards between the same two adjacent items ~50 times, `posB - posA` drops below machine epsilon, causing collisions where distinct tasks receive identical positions.
- **Resolution**:
  1. Use double precision float with initial spacing interval of `1000.0`.
  2. Implement an automated rebalance trigger: if `abs(posB - posA) < 1e-6`, trigger a background non-blocking rebalancing transaction for that column (`position = (index + 1) * 1000.0`).
- **Status**: Incorporated into [docs/design.md](file:///c:/Users/rohit/OneDrive/Documents/TaskSync/docs/design.md).

---

### Entry 002: At-Most-Once Delivery in Redis Pub/Sub (Phase 0 Design Review)
- **Component**: Notification & Activity Feed Delivery (`task-events`)
- **Initial Assumption**: Solely relying on standard Redis Pub/Sub for worker notification processing.
- **Problem Identified**: Standard Redis Pub/Sub is fire-and-forget. If `notification-service` is temporarily down or restarting during deployment, events emitted during that downtime are permanently lost.
- **Resolution**:
  1. The core board state mutation is always committed durably to PostgreSQL first in `api-service`.
  2. For critical activity feeds, either persist the `ActivityLog` in the main transaction or utilize Redis Streams (`XADD` with consumer groups) if workers require guaranteed at-least-once delivery.
- **Status**: Documented as an interview trade-off in [docs/design.md](file:///c:/Users/rohit/OneDrive/Documents/TaskSync/docs/design.md).

---

### Entry 003: Monorepo Prisma CLI Environment Resolution (Phase 1)
- **Component**: Prisma CLI migrations in npm workspaces
- **Initial Setup**: Relying on root `.env` for sub-package `prisma db push` invocations without explicitly copying or passing path flags.
- **Problem Identified**: The Prisma CLI searches the directory containing `schema.prisma` (`services/api-service`) for `.env` by default and threw error `P1012: Environment variable not found: DATABASE_URL`.
- **Resolution**: Ensured each service contains its local `.env` configuration (derived safely from `.env.example`) and added dotenv fallback resolution in `src/lib/env.ts`.
- **Status**: Resolved and tested with live PostgreSQL container.

---

### Entry 004: Request-Scoped DataLoaders vs Global Singletons (Phase 2)
- **Component**: DataLoader Batching Engine (`src/graphql/loaders.ts`, `src/graphql/context.ts`)
- **Common Anti-Pattern**: Instantiating DataLoader instances once at server startup as global singletons.
- **Problem Identified**: DataLoader caches promise results in-memory. If instantiated globally across requests, User A could read stale or unauthorized cached data loaded during User B's prior request, causing data leaks and cross-request stale cache bugs.
- **Resolution**: `createLoaders(prisma)` is called inside `buildContext` on every incoming GraphQL HTTP request and WebSocket connection tick. The DataLoader memoization cache lives strictly for the duration of a single GraphQL query execution tick and is immediately garbage collected.
- **Status**: Implemented and verified in [src/graphql/context.ts](file:///c:/Users/rohit/OneDrive/Documents/TaskSync/services/api-service/src/graphql/context.ts).

---

### Entry 005: Sensor Distance Constraint in @dnd-kit (Phase 3)
- **Component**: Frontend Drag-and-Drop (`src/components/KanbanBoard.tsx`)
- **Common Anti-Pattern**: Initializing `PointerSensor` with default parameters without an activation constraint.
- **Problem Identified**: Without an activation constraint, any simple click event (such as clicking the delete button or clicking into a task to view details) triggers a drag start event, creating jitter and preventing normal button clicks or text selection.
- **Resolution**: Configured `activationConstraint: { distance: 5 }` on the `PointerSensor`. The drag lifecycle only initiates if the user moves the pointer by more than 5 pixels while holding the mouse button down, preserving regular click events.
- **Status**: Implemented in [src/components/KanbanBoard.tsx](file:///c:/Users/rohit/OneDrive/Documents/TaskSync/apps/web/src/components/KanbanBoard.tsx).

---

### Entry 006: Dual-PubSub Architecture for Subscriptions & Microservices (Phase 4)
- **Component**: Real-Time Event Dispatch (`src/lib/pubsub.ts`)
- **Initial Setup**: Attempting to route internal Apollo Server subscriptions through Redis Pub/Sub without an in-process fallback or dual-dispatch.
- **Problem Identified**: If the Redis client drops connection or experiences transient reconnect backoff, internal WebSocket subscribers connected to the local Node process could fail to receive real-time UI updates even though the database write succeeded.
- **Resolution**: Implemented `emitBoardEvent` as a dual-dispatch layer: it immediately emits to the local `PubSub` engine to guarantee immediate delivery to connected browser clients, while asynchronously publishing to the Redis `task-events` channel for the independent `notification-service` to log and notify.
- **Status**: Implemented and verified in [src/lib/pubsub.ts](file:///c:/Users/rohit/OneDrive/Documents/TaskSync/services/api-service/src/lib/pubsub.ts).

---

### Entry 007: JWT Secret Inconsistency Between Runtime Services and Scripts (Phase 5)
- **Component**: Authentication & Benchmark Scripts (`scripts/seed-benchmark.mjs`, `.env`)
- **Initial Setup**: Root `.env` contained a sample JWT token string as `JWT_SECRET` (`eyJhbGci...`), while fallback defaults in scripts used a standard plaintext secret string (`super_secret_jwt_key_...`).
- **Problem Identified**: When running the API server and standalone benchmark seeding scripts, path resolution differences caused the seeder script to fall back to the default secret while the server verified tokens using the `.env` value. This caused automated benchmark requests to fail with `UNAUTHENTICATED` ("Authentication required. Please provide a valid Bearer token.").
- **Resolution**:
  1. Synchronized the `JWT_SECRET` across root `.env` and `services/api-service/.env` to use the unified standard secret.
  2. Fixed dotenv loading paths in benchmark scripts to reliably resolve the project root configuration.
- **Status**: Resolved and validated in [docs/benchmarks.md](file:///c:/Users/rohit/OneDrive/Documents/TaskSync/docs/benchmarks.md).

---

### Entry 008: Zod Whitespace Validation Order of Operations (Phase 6)
- **Component**: Input Validation Schemas across all resolvers (`createTaskSchema`, `createBoardSchema`, `createWorkspaceSchema`, `createColumnSchema`)
- **Initial Setup**: Input string fields defined with `.min(1).trim()`.
- **Problem Identified**: In Zod method chaining, order of operations matters. `.min(1).trim()` verifies that the un-trimmed string length is `>= 1` *before* trimming whitespace. As a result, whitespace-only strings like `"   "` had length 3, passed the `.min(1)` check, were trimmed to empty string `""`, and slipped past validation into the database.
- **Resolution**: Reordered schema calls to `.trim().min(1, '...')` across all entities so input strings are stripped of leading/trailing whitespace prior to evaluating minimum character length. Added unit tests in `tests/unit/workspace_resolver.unit.test.ts` and `tests/unit/task_resolver.unit.test.ts` to assert rejection of whitespace-only strings.
- **Status**: Fixed and verified across all mutation resolvers.

---

### Entry 009: Missing Prisma Client Generation in Worker Dockerfile (Phase 7)
- **Component**: Docker Container Build (`services/notification-service/Dockerfile`)
- **Initial Setup**: The `notification-service` Dockerfile copied its local package manifests and ran `npm install` and `npm run build` without copying the Prisma schema or invoking `prisma generate`.
- **Problem Identified**: The TypeScript compiler failed during image creation with `TS2305: Module '"@prisma/client"' has no exported member 'TaskAction'`, because `@prisma/client` defaults to an empty un-generated stub until `prisma generate` is explicitly executed against the schema.
- **Resolution**: Updated `services/notification-service/Dockerfile` to copy `services/api-service/prisma` into the builder stage, run `npx prisma generate --schema=./services/api-service/prisma/schema.prisma`, and copy the generated `.prisma` and `@prisma` output directories into the final production runner stage.
- **Status**: Tested and verified; all 3 Docker images build successfully.





