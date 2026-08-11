# Storage — Fase 4

Estado: implementado con abstracción S3-compatible para AWS S3, Cloudflare R2 y MinIO.

## Componentes

- `lib/storage/s3-client.ts`: adapter S3-compatible con upload, delete físico, head/exists y signed URLs.
- `lib/storage/r2-client.ts`: alias de compatibilidad para código anterior.
- `lib/storage/storage-config.ts`: configuración, allowlist de MIME/extensiones, sanitización de nombres y storage keys.
- `lib/services/storage-service.ts`: servicio de dominio para Evidence.

## Variables

```env
S3_ENDPOINT=""
S3_REGION="auto"
S3_BUCKET=""
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_FORCE_PATH_STYLE="false"
S3_SIGNED_URL_EXPIRY="86400"
```

## Validación De Upload

El upload valida en servidor:

- tamaño máximo (`10 MB` por defecto)
- firma/magic bytes del archivo
- MIME detectado contra allowlist
- coherencia entre MIME declarado y detectado
- extensión compatible con el MIME detectado
- nombre de archivo sanitizado para storage key

Tipos aceptados inicialmente:

- JPEG
- PNG
- WebP
- PDF
- MP4
- WebM
- QuickTime MOV

## URLs

Las URLs firmadas se generan bajo demanda y no se tratan como URLs permanentes. El campo `Evidence.url` queda reservado para recursos legacy/public o externos.

## Delete Seguro

`DELETE /api/evidence/:id` hace soft delete:

- marca `deletedAt`
- registra `deletedBy`
- borra la URL temporal en metadata
- conserva el objeto en storage para auditoría/rollback
- registra `AuditLog` sobre la entidad `Evidence`

Un borrado físico se considera una operación de retención/purga separada y no queda expuesto en la API pública inicial.

## Migración

Se agregó:

- `Evidence.updatedAt`
- `Evidence.deletedAt`
- `Evidence.deletedBy`
- relación `User.evidenceDeleted`
- índices `evidence_deletedAt_idx` y `evidence_deletedBy_idx`

Migración:

- `prisma/migrations/zzzz_20260811020000_evidence_soft_delete/migration.sql`

## Verificación

- `npx prisma generate`: OK.
- `npx prisma validate`: OK.
- `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`: OK, incluye columnas e índices de Evidence.
- `npx tsc --noEmit --pretty false`: no reporta errores en storage/schema; siguen errores previos de UI/tests/offline/search.
