# P1-B backup policy — propuesta pendiente de aprobación

## Estado

```text
BACKUP_POLICY_EXISTS=YES
BACKUP_POLICY_APPROVED=NO
BACKUP_POLICY_IMPLEMENTED=NO
RPO_TARGET=PENDIENTE_APROBACION_HUMANA
RTO_TARGET=PENDIENTE_APROBACION_HUMANA
```

Este documento es una **PROPUESTA**. No autoriza automatizaciones, eliminación de
backups, cambios de producción ni apertura de purge. Los valores propuestos deben
ser aprobados y los responsables deben aceptar formalmente su función antes de
considerar satisfecha la política exigida por D6-bis.B.

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
| Frecuencia | diaria, inicio 02:00 UTC; adicional antes de releases/migraciones | PENDIENTE_APROBACION_HUMANA |
| Retención | 35 diarios, 12 semanales y 12 mensuales | PENDIENTE_APROBACION_HUMANA |
| Responsable | owner operativo de Pruebas María, persona nominal por designar | PENDIENTE_APROBACION_HUMANA |
| Suplente | SRE/infra de guardia, persona nominal por designar | PENDIENTE_APROBACION_HUMANA |
| RPO target | 24 horas | PENDIENTE_APROBACION_HUMANA |
| RTO target | 4 horas | PENDIENTE_APROBACION_HUMANA |
| Restore periódico | trimestral y después de cambios materiales de DB/storage/auth | PENDIENTE_APROBACION_HUMANA |
| Canal de alertas | canal operativo y escalación fuera de banda, por designar | PENDIENTE_APROBACION_HUMANA |

La retención propuesta no debe aplicarse retroactivamente ni borrar snapshots
existentes hasta contar con aprobación, inventario de paths exactos y verificación
de que ninguna copia es única.

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

Se requieren decisiones humanas explícitas sobre frecuencia, retención, RPO, RTO,
responsable nominal, suplente nominal, canal de alertas y presupuesto/destino
off-host. Después deben implementarse y observarse al menos una ejecución automática
completa y su alerta de heartbeat antes de declarar:

```text
BACKUP_POLICY_APPROVED=YES
BACKUP_POLICY_IMPLEMENTED=YES
```
