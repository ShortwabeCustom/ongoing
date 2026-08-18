# P1-B backup policy — propuesta pendiente de aprobación

## Estado

```text
BACKUP_POLICY_EXISTS=YES
BACKUP_POLICY_APPROVED=PARTIAL
BACKUP_POLICY_IMPLEMENTED=NO
RPO_TARGET=PENDIENTE_APROBACION_HUMANA
RTO_TARGET=PENDIENTE_APROBACION_HUMANA
```

La generación y monitorización no destructiva están aprobadas e implementadas. La
retención destructiva continúa pendiente porque los valores siguen marcados como
`PENDIENTE_APROBACION_HUMANA` en la decisión documental previa. Este documento no
autoriza eliminación de backups ni apertura de purge.

```text
BACKUP_RESPONSIBLE=Alexis Valdez Cortez
BACKUP_DEPUTY=NONE
SINGLE_OPERATOR_MODE=YES
SINGLE_OPERATOR_RISK=ACCEPTED
BACKUP_ALERT_CHANNEL=Email
ALERT_RECIPIENT=alexis.pro_sk8@hotmail.com
ALERT_DELIVERY_METHOD=SMTP_OAUTH2_REQUIRED
```

El riesgo aceptado es que no existe un segundo administrador humano si el operador
principal no está disponible. Backups automáticos, copia cifrada off-host, hashes,
alertas email, runbook y restores trimestrales son controles compensatorios, no un
reemplazo de un suplente.

## Alcance confirmado

Cada punto de recuperación P1-B debe tratar PostgreSQL y el storage privado como
una sola unidad operativa:

- dump custom de `pruebas_maria_prod`, sin owner ni privilegios;
- archive completo del root canónico de private Evidence storage;
- manifest sin secretos que identifique commit, versiones, conteos y ventana UTC;
- `SHA256SUMS` verificado en origen;
- copia off-host cifrada y verificación independiente de hashes;
- retención conjunta de DB, bytes, manifest, hashes e informes DR.

Un backup incompleto de cualquiera de los dos componentes se considera fallido.

## Parámetros propuestos

| Campo | Propuesta | Estado |
|---|---|---|
| Frecuencia | diaria, inicio 02:00 UTC; adicional antes de releases/migraciones | HUMAN_APPROVED |
| Retención | 35 diarios, 12 semanales y 12 mensuales | PENDIENTE_APROBACION_HUMANA |
| Responsable | Alexis Valdez Cortez | HUMAN_APPROVED |
| Suplente | ninguno; modo operador único | HUMAN_APPROVED_RISK_ACCEPTED |
| RPO target | 24 horas | HUMAN_APPROVED |
| RTO target | 4 horas | HUMAN_APPROVED |
| Restore periódico | trimestral y después de cambios materiales de DB/storage/auth | HUMAN_APPROVED |
| Canal de alertas | email a `alexis.pro_sk8@hotmail.com`, SMTP seguro con OAuth2 | HUMAN_APPROVED; SECRET_PENDING |

La retención propuesta no debe aplicarse retroactivamente ni borrar snapshots
existentes hasta contar con aprobación, inventario de paths exactos y verificación
de que ninguna copia es única.

## Implementación observada — 2026-08-18

La automatización instalada usa un LaunchAgent en el Mac porque el mecanismo
off-host verificado es un pull por SSH/rsync. A las 20:00 de la zona local UTC−06
ejecuta el recovery point de las 02:00 UTC. El mismo job crea el snapshot en el VPS,
copia al Mac, verifica hashes en ambos extremos y sólo entonces escribe `SUCCESS` y
heartbeat. Un monitor cada 15 minutos detecta backup ausente después de 26 horas y
restore vencido después del trimestre; los eventos se conservan en un spool `0700`.

La corrida observada válida fue `p1b-auto-20260818T175747Z`: DB, storage, manifest,
hash origen, copia off-host, hash destino y heartbeat fueron PASS. Los inventarios
pre-política existen en ambos extremos. `RETENTION_DELETE_ENABLED=NO` y ningún
backup histórico fue eliminado.

La entrega email no está instalada ni verificada. Outlook.com exige autenticación
moderna/OAuth2; no se habilitará autenticación básica ni se usará la contraseña
normal. Falta provisionar identidad emisora y OAuth en
`/etc/pruebas-maria/backup-alert.env`, root:root `0600`. El template versionado sólo
contiene nombres de variables en `ops/backup-alert.env.example`.

## Ejecución y verificación propuestas

1. Crear el dump PostgreSQL online y el archive del storage privado en un directorio
   nuevo `0700`, con ficheros `0600`.
2. Generar manifest y SHA-256; cualquier fallo invalida el punto completo.
3. Copiar el snapshot a un destino off-host con cifrado at-rest comprobado.
4. Recalcular y verificar SHA-256 en el destino, sin confiar sólo en el transporte.
5. Publicar una métrica/heartbeat fechado que incluya éxito de DB, storage, copia y
   hashes, sin rutas internas ni secretos.
6. Conservar logs e informe del job durante al menos la misma ventana que el backup.

## Monitorización y respuesta propuestas

Generar alerta si ocurre cualquiera de estas condiciones:

- no existe un punto completo dentro de las últimas 26 horas;
- falla dump, archive, manifest, copia off-host o verificación de hash;
- el conteo de ficheros/filas no puede obtenerse o presenta una caída inesperada;
- el destino off-host no está disponible o su cifrado no puede verificarse;
- el restore periódico vence o falla alguno de sus smokes.

La alerta debe abrir incidente y notificar al responsable y suplente en un máximo
de 15 minutos. Ante fallo:

1. no borrar ni sobrescribir el último snapshot válido;
2. conservar artefactos parciales para diagnóstico, claramente marcados INVALID;
3. reintentar una sola vez si la causa es transitoria y el reintento es no destructivo;
4. escalar si no existe un backup válido dentro del RPO propuesto;
5. ejecutar un restore aislado si hay duda sobre integridad;
6. mantener purge cerrado hasta resolver el incidente y recuperar evidencia PASS.

## Restore periódico propuesto

El ejercicio debe usar PostgreSQL 16 en container Linux, puertos loopback, DB y
credenciales efímeras, y storage Linux aislado con directorios `0700`, ficheros
`0600` y owner del proceso DR. Debe comprobar:

- schema e historial Prisma;
- metadata y Finding de una Evidence privada conocida;
- sesión existente en el backup;
- `/api/auth/session` con usuario válido;
- GET autenticado 200 y bytes MATCH;
- Range 206 y GET anónimo 401;
- eliminación dirigida de app, container y credenciales temporales;
- preservación del backup y del informe firmado con SHA-256.

## Condiciones para implementación

Antes de declarar la política completamente implementada falta: aprobación explícita
de la retención destructiva en la documentación vigente; sender/app OAuth; creación
root-owned del secreto; conexión del spool al emisor; y una única prueba SMTP real.

```text
BACKUP_POLICY_APPROVED=PARTIAL
BACKUP_POLICY_IMPLEMENTED=NO
```
