# Electron SQLite REST Template Backend

This backend is the runnable server used by the Electron app and packaged builds.

## What Runs Now

- Entry: `src/main/server/app.js`
- Routing table: `src/main/server/modules/index.js`
- Storage: `better-sqlite3 + drizzle-orm/better-sqlite3`
- API style: public-first template API, with one protected auth example

The current runnable template backend uses `src/main/server/modules/`.

## Current Structure

```text
src/main/server/
├── database/           # better-sqlite3 connection + drizzle schema/migrations
├── middleware/         # shared Express middleware
├── modules/            # lightweight MVC modules
│   ├── <domain>/
│   │   ├── router.js
│   │   ├── controller.js
│   │   ├── service.js
│   │   └── repository.js
│   └── index.js
├── etc/                # environment-based config
├── utils/              # shared helpers
└── app.js              # Express bootstrap
```

## Lightweight MVC Rules

Each module follows this flow:

1. `router.js` defines URL mappings.
2. `controller.js` reads request data and formats API responses.
3. `service.js` contains business rules and validations.
4. `repository.js` contains Drizzle queries and persistence logic.

This keeps SQL out of route registration and keeps template logic easy to copy into a new app.

## Template Modules

- `health`: service health probe
- `dashboard`: summary and chart data
- `system`: system stats CRUD
- `process`: CRUD demo
- `settings`: generic key-value settings API
- `about`: template metadata API
- `auth`: register, login, refresh, me, and one protected example route

## Auth Strategy

- Most APIs are intentionally open for template usability.
- Only `/api/auth/protected-example` is permission-protected by default.
- Demo accounts are seeded in the SQLite bootstrap.

This keeps the template easy to preview while still showing a real auth and permission flow.

## How To Add A New Module

Create a new folder under `src/main/server/modules/<domain>/` with:

- `router.js`
- `controller.js`
- `service.js`
- `repository.js` if the module touches SQLite

Then register it in `src/main/server/modules/index.js`.

## Packaging Notes

- `scripts/copy-server.cjs` copies `src/main/server/` into `out/main/server/`
- Electron packaged builds run the copied server from `out/main/server/app.js`
- The active runtime path is `app.js -> modules/index.js`
- Development runtime files are created under project root `.runtime/embedded-api/`
- Packaged builds write DB/logs under Electron `userData/embedded-api/`
- `drizzle.config.js` points Drizzle Kit at `src/main/server/database/schema.js`
- `src/main/server/database/migrations/` is copied into packaged builds and applied automatically on startup
