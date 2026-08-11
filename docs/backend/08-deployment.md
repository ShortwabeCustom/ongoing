# Deployment

## Build

Production build:

```bash
pnpm build
```

The script runs `next build --webpack`. Next.js 16 supports this flag; it is used because Turbopack fails in this host while processing CSS with an internal bind operation.

## PM2 deployment

Use the PM2 deploy helper on the VPS:

```bash
./scripts/deploy-pm2.sh
```

The helper stops `uix-torrax-cloud` before rebuilding `.next`, then installs dependencies, generates Prisma Client, builds, applies migrations and restarts PM2. Do not run `pnpm build` in place while `next start` is serving traffic from the same directory; the build replaces `.next` and can briefly remove files that the running process still needs.

Override the process name when needed:

```bash
PM2_APP_NAME=my-process ./scripts/deploy-pm2.sh
```

## Environment

Start from `.env.example` and provide real values through the deployment platform secret store.

Required for the backend foundation:

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

Optional or feature-gated:

- `S3_FORCE_PATH_STYLE`
- `S3_SIGNED_URL_EXPIRY`
- `NEXT_PUBLIC_ENABLE_OFFLINE_SYNC`
- `NEXT_PUBLIC_IMPORT_MAX_FILE_SIZE`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `ELASTICSEARCH_URL`
- `ELASTICSEARCH_FINDINGS_INDEX`
- `SENTRY_DSN`
- `LOG_LEVEL`

Do not commit real credentials. `.env.production` is a placeholder template only.

## Database

Development:

```bash
npx prisma migrate dev
npx prisma generate
```

Production:

```bash
npx prisma migrate deploy
npx prisma generate
```

Do not run destructive migration commands against production. Use `SHADOW_DATABASE_URL` when validating migration drift with Prisma diff workflows.

## Storage

Evidence binaries are uploaded through `StorageService` to an S3-compatible backend. Metadata remains in PostgreSQL.

Supported providers:

- AWS S3
- Cloudflare R2
- MinIO

Runtime must grant the app permission to `PutObject`, `GetObject`, `DeleteObject` if hard delete is later enabled, and signed URL generation for private reads.

## PWA

The dynamic app mounts `ServiceWorkerRegister`, which registers `/sw.js`.

The service worker:

- caches app shell and immutable public assets,
- does not precache authenticated API responses,
- serves `offline.html` for navigation fallback,
- stores mutation queue items in IndexedDB version 2,
- processes sync via Background Sync when supported.

## Security

Production checklist:

- Use HTTPS only.
- Set a strong `AUTH_SECRET`.
- Keep `DATABASE_URL`, S3 credentials, VAPID private key and Sentry DSN out of source control.
- Apply Prisma migrations before starting the app.
- Keep object storage private unless a provider-specific public bucket is explicitly intended.
- Add edge/app-platform rate limiting for login, import preview/confirm and uploads.
- Capture structured logs with request id, operation, entity id and error code.
- Avoid logging passwords, tokens, cookies or raw secrets.

## Backups

Minimum production backup plan:

- PostgreSQL point-in-time recovery or daily snapshots.
- Object storage lifecycle retention for evidence objects.
- Periodic export of import batches and audit logs.
- Restore rehearsal before first production rollout.
