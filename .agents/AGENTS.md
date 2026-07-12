# Workspace Rules & Architecture Guidelines

> [!IMPORTANT]
> **Primary Project Focus**: All active development and new features must be implemented exclusively in the full-stack TanStack Start application (`excalidraw-start/`). The legacy Vite app (`excalidraw-app/`) is kept purely as a reference. Do not modify `excalidraw-app/` unless explicitly requested.

Welcome! This document outlines the project structure, configuration patterns, and development guidelines for the `my-notebook` Excalidraw monorepo.

---

## 1. Monorepo Architecture

This workspace is managed using Yarn Workspaces:
- **`packages/*`**: Shared internal library packages.
  - `packages/excalidraw`: The main Excalidraw canvas component.
  - `packages/common`, `packages/element`, `packages/math`, `packages/utils`: Helper packages for canvas logic.
- **`excalidraw-app/`**: The original client-only Vite Single Page Application (SPA).
- **`excalidraw-start/`**: The full-stack TanStack Start application with server-side rendering, routing, and SQLite database storage.

---

## 2. Path Aliases & Dependency Resolution

To work with source files directly instead of pre-compiled assets, the bundlers utilize path aliases mapping `@excalidraw/*` to `packages/*/src/index.ts`.
*   **Vite App**: Configured in `excalidraw-app/vite.config.mts`.
*   **TanStack Start App**: Configured in `excalidraw-start/vite.config.ts`.
*   When editing shared packages under `packages/`, you do not need to run manual builds; Vite/Vinxi automatically re-compiles them through path aliases.

---

## 3. Technology Stack & Guidelines

### Client-Only Canvas Rendering
Excalidraw is a browser-only library referencing DOM objects (`window`, `document`, canvas APIs). Because TanStack Start performs Server-Side Rendering (SSR) by default:
- **Rule**: Never import and render `<Excalidraw />` directly in routing pages.
- **Fix**: Wrap Excalidraw inside a client-only component and load it dynamically using `React.lazy()` with a `<Suspense>` wrapper:
  ```typescript
  const DrawingCanvas = React.lazy(() => import('../components/DrawingCanvas'))
  ```

### Prisma 7 & SQLite Driver Adapter
We use Prisma v7 and SQLite (`dev.db`). Under Prisma 7, connection URLs are no longer defined in `schema.prisma`. Instead:
- Connection URL must reside in `excalidraw-start/prisma.config.ts`.
- The `PrismaClient` constructor expects an explicit driver adapter. Initialize it like this:
  ```typescript
  import { PrismaClient } from '@prisma/client'
  import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || 'file:./prisma/dev.db'
  })

  export const prisma = new PrismaClient({ adapter })
  ```

### Server Functions & Cookie Management
For authentication and database queries, use TanStack Start server functions.
- For reading/writing cookies, use official server utilities:
  ```typescript
  import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server'
  ```
- Set session redirects using standard browser redirection (`window.location.href = '/'`) rather than concurrent router navigation to ensure cookies are updated without interrupting the active route state.

---

## 4. Common Development Commands

Run these commands from the monorepo root directory:

*   **Start original Vite App**: `yarn start`
*   **Start TanStack Start App**: `yarn start:start` (dev server runs on port 3000)
*   **Build TanStack Start App**: `yarn build:start`
*   **Generate Route Tree**: `yarn --cwd ./excalidraw-start generate-routes`
*   **Database Migration Push**: Run `npx prisma db push` inside `excalidraw-start/`
*   **Prisma Client Generation**: Run `npx prisma generate` inside `excalidraw-start/`
