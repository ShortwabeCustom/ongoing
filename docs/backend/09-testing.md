# Testing

## Commands

Validated in this migration:

```bash
npx prisma validate
npx tsc --noEmit --pretty false
pnpm test
pnpm lint
node --check public/sw.js
pnpm build
```

## Current Results

- Prisma schema: valid.
- TypeScript: passing.
- Vitest: 7 files, 70 tests passing.
- ESLint: passing with warnings.
- Service worker syntax: passing.
- Production build: passing with `next build --webpack`.

## Test Coverage Added Or Repaired

- Vitest dependencies and config.
- Path alias resolution for `@/*`.
- DOM environment for React hook tests.
- Unit mocks for push notifications, subscriptions, realtime and activity services.
- Notification subscribe route tests aligned with `NextResponse`.

## Known Gaps

Integration tests still need a disposable PostgreSQL database and object storage fixture before they can safely cover:

- create finding,
- update finding,
- unauthorized update,
- conflict `409`,
- import preview,
- duplicate import,
- transaction rollback,
- evidence upload to real S3-compatible storage.

E2E coverage is also pending for:

- importing a historical file,
- opening a finding detail,
- changing status,
- attaching evidence,
- validating a finding.

## CI Recommendation

Run this sequence before deploy:

```bash
npx prisma validate
npx tsc --noEmit --pretty false
pnpm test
pnpm lint
pnpm build
```

For production deploys, run:

```bash
npx prisma migrate deploy
pnpm start
```
