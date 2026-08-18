# Prisma production baseline

Baseline date: 2026-08-18

The historical migrations were baselined in production but were not replayable
from an empty PostgreSQL database. A production-to-`schema.prisma` diff was
confirmed with no drift before this squash (`PROD_SCHEMA_DRIFT=NO`).

The following historical migrations are preserved in Git history, together with
their previously verified production checksums:

| Migration | SHA-256 |
| --- | --- |
| `1786121852_init` | `517ac48b532566a51d9185cfd3e324b480f238fba45274389e65fbbdc36b3914` |
| `20260813185807_make_test_session_optional` | `f9e19d8cbee5409c5d114cc403050c7d16d106f28c42d6df90451606fd71305b` |
| `20260814000717_add_support_links_model` | `a9e540a6cb4d5116db02e7ad39481953b825a79674f81183060e9fe06f87b3dc` |
| `add_activities_fase10` | `b91978439b15a5f9e382cf1ebc7fefdb20c00cbbe59a970a9eeefe4ca7fb04ba` |
| `add_auth_session` | `d0c6f3bc4596b13d0b7b8c6e73a714b29e32c68d30de08c1b3568c7285489711` |
| `zz_20260811000000_reconcile_phase1_schema` | `8627c8e60ab6e2095731f775c25e227f96207a1b341d3f48221b2011fe0b6bb1` |
| `zzz_20260811010000_import_fingerprint` | `84dabb61e929606cc863d3e43dfd4d5dbc5736be2438a03058da7833ac5ecba1` |
| `zzzz_20260811020000_evidence_soft_delete` | `4f8599fa084163ffceec84be6920b51fe5d24eab5eb0944c92b51ed185781dc2` |

The active history now starts with
`000000000000_squashed_migrations`, generated from an empty database to the
current `prisma/schema.prisma` using the project Prisma CLI.

Do not edit this baseline after it has been applied or resolved in any database.
Every future migration must sort after `000000000000_squashed_migrations`.
