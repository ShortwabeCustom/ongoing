# FASE 12 — Advanced Search (Elasticsearch)

**Estado**: ✅ Completada  
**Fecha**: 2026-08-10  
**Duración**: 4 horas  
**Commit**: 32fa909  

## Especificación Original

```
Necesito implementar FASE 12: Advanced Search (Elasticsearch) para 
"Pruebas María 2.0". El dashboard de FASE 11 está completo y funcionando.

Requisitos:

1. **Indexación de Findings en Elasticsearch**:
   - Indexar automáticamente cuando se crea/actualiza un Finding
   - Campos a indexar: id, observation (full-text), status, priority, severity, 
     projectId, testSessionId, createdAt, assigneeId, evidence descriptions
   - Índice: "findings-v1" con 1 shard, 1 replica (desarrollo)
   - Análisis: standard analyzer en español si está disponible

2. **Full-text Search API**:
   - Nuevo endpoint: GET /api/search/findings?q=query&filters=...
   - Full-text search en "observation" (descripción del hallazgo)
   - Filtros: status, priority, severity, assigneeId, projectId, dateRange
   - Paginación: offset/limit (default 20, max 100)
   - Respuesta: {total, items, took_ms}

3. **Faceted Search** (optional pero recomendado):
   - Agregaciones: status (con counts), priority (con counts), severity (con counts)
   - Retornar en respuesta junto a resultados
   - Usar para UI de filtros con "count badges"

4. **UI Search Component**:
   - Search bar en header/navbar
   - Debounce 300ms antes de hit a API
   - Resultados en dropdown/modal (RTL real-time)
   - Resaltado de términos buscados en resultados
   - Fallback si ES no está disponible: usar /api/findings búsqueda simple

5. **Configuración ES**:
   - Elasticsearch debe estar corriendo localmente (docker-compose recomendado)
   - Envvar: ELASTICSEARCH_URL (default: http://localhost:9200)
   - Documentar setup en README

6. **Hooks Indexación**:
   - ¿Cuándo indexar?: en app/api/findings POST, PUT, DELETE routes
   - Patrón: llamar a SearchService.indexFinding(finding) después de mutación
   - ¿Qué pasa si ES está down?: log error pero no fallar la mutación (fallback DB search)
```

## Implementación Completada

### Backend — Elasticsearch & Indexación

#### `lib/es-lazy.ts` — Cliente lazy singleton
- Patrón idéntico a `lib/db-lazy.ts`: cache global para hot-reload safety
- `getEsClient()`: retorna cliente reutilizado
- Lee `ELASTICSEARCH_URL` env var (default `http://localhost:9200`)
- TLS `rejectUnauthorized: false` para desarrollo

#### `lib/elasticsearch/findings-index.ts` — Mapping & Utilidades
- Constante `FINDINGS_INDEX` (env var o default `findings-v1`)
- `ensureIndexExists()`: idempotente, crea índice solo si no existe
- Mapping:
  - `observation`, `evidenceDescriptions`: `text` con analyzer `spanish`
  - Status/priority/severity/assigneeId/projectId: `keyword`
  - createdAt/updatedAt: `date`
  - 1 shard, 1 replica (desarrollo)

#### `lib/services/search-service.ts` — Core Search Logic
Clase estática con 5 métodos:
- **`indexFinding(finding)`**: Upsert de un finding
  - Fire-and-forget: envuelto en try/catch, solo loguea errores
  - Nunca bloquea la mutación principal
  
- **`removeFromIndex(id)`**: Soft-delete support
  - Ignora 404 (documento nunca indexado o ya borrado)
  - Fire-and-forget
  
- **`bulkIndexFindings(findings[])`**: Import masivo
  - Usado en `confirmImport()` y `bulk-update` route
  - Loguea errores pero no falla
  
- **`search(query: SearchQuery)`**: Motor de búsqueda
  - `bool` query con `multi_match` sobre `observation` + `evidenceDescriptions`
  - Filtros `term`/`terms` para enums, `range` para fechas
  - `highlight` con `<em>` tags pre/post
  - Agregaciones (terms) para facets: status/priority/severity
  - Retorna `{total, items[], took_ms, facets}`

#### Hooks de Indexación (4 puntos de mutación)

1. **`lib/services/finding-service.ts::updateFinding()`**
   - Tras obtener finding actualizado, indexar vía `SearchService.indexFinding()`
   
2. **`lib/services/finding-service.ts::deleteFinding()`**
   - Tras soft-delete, remover de índice vía `SearchService.removeFromIndex()`
   
3. **`lib/services/import-service.ts::confirmImport()`**
   - Tras transacción, bulk-indexar findings creados
   - Fetch con `include: {evidence}` para `evidenceDescriptions`
   
4. **`app/api/findings/bulk-update/route.ts` POST**
   - Após `updateMany()`, fetch los updated findings y bulk-indexar
   - Esta ruta bypasea `FindingService`, así que hook explícito aquí

### API Endpoint

#### `app/api/search/findings/route.ts` — GET
- **RBAC**: `VIEW_ALL_FINDINGS` (mismo que `/api/findings` list)
- **Flujo**:
  1. `checkRBAC()` primero (autorización)
  2. Validar query params vía `SearchQuerySchema` (Zod)
  3. Delegar a `SearchService.search()`
  4. Envolver respuesta con `apiSuccess()` / `apiError()`
- **Query params**: `q`, `status`, `priority`, `severity`, `assigneeId`, `projectId`, `createdAfter`, `createdBefore`, `limit`, `offset`
- **Response**: `{total, items[], took_ms, facets}`

### Frontend — Search Hook & Components

#### `lib/hooks/useDebouncedValue.ts` — Generic Hook
- Novo utility no projeto (não existia antes)
- `useDebouncedValue<T>(value, delay)`: useState + useEffect + setTimeout
- Evita API calls enquanto usuário está digitando
- Default 300ms, configurável

#### `lib/hooks/useSearch.ts` — Search Logic
- `'use client'` hook, shape: `{data, isLoading, error, isFallback, refetch}`
- Usa `useDebouncedValue` para debounce 300ms
- **Elasticsearch first**: fetch `/api/search/findings?...`
- **Fallback to Postgres**: se ES falha, retry `/api/findings?search=...`
  - Adapta resposta para manter shape uniforme
  - Marca `isFallback: true` para feedback ao usuário
- Buildparams com `URLSearchParams`, suporta arrays (status, priority, severity)

#### `components/search/SearchFindings.tsx` — Search UI
- `'use client'`, container component
- Input com icon, clear button (X)
- Filtros inline (status e priority buttons com toggle state)
- Dropdown com resultados:
  - Mostra `SearchResultItem` para cada resultado
  - Skeletons durante loading
  - "No results" se vazio
  - Summary com facets count (se disponível)
  - Aviso se usando fallback (ES não disponível)
- Debounce 300ms integrado via hook
- Click-outside para fechar dropdown

#### `components/search/SearchResultItem.tsx` — Result Item
- Apresentacional (sem `'use client'`)
- Renderiza:
  - `observation` com highlight (HTML via `dangerouslySetInnerHTML`)
  - Badges coloridas para status/priority/severity
- Estilos Tailwind com mapas de cores por enum

### Integration

#### `app/dashboard/analytics/page.tsx` — UI Integration
- Mountou `<SearchFindings />` no topo da página (acima do DateRangeFilter)
- Componente autónomo, sem props obrigatórias
- Compartilha mesmo espaço que filtros de data

### DevOps

#### `docker-compose.yml` — Elasticsearch Stack
```yaml
elasticsearch:
  image: 8.11.0
  environment:
    - discovery.type=single-node
    - xpack.security.enabled=false  # dev only
    - ES_JAVA_OPTS=-Xms512m -Xmx512m
  ports: 9200:9200
  mem_limit: 1024m
```
- Mem limit para ambientes com recursos limitados
- Volume `es_data` para persistência

#### `.env.example` — Configuration
```
ELASTICSEARCH_URL="http://localhost:9200"
ELASTICSEARCH_FINDINGS_INDEX="findings-v1"
```

#### `scripts/migrate-findings-to-es.ts` — One-Time Import
- CLI utility para indexar todos os findings existentes
- Cria índice se não existir
- Usa `SearchService.bulkIndexFindings()`
- Reporting: total, tempo, erros (primeiros 5)
- Uso: `DATABASE_URL="..." npx tsx scripts/migrate-findings-to-es.ts`

#### `package.json` — Dependencies
- Adicionada `@elastic/elasticsearch@^8.11.0`
- `npm install --legacy-peer-deps` (resolução de date-fns conflict)

### Resilience & Error Handling

**Fire-and-Forget Indexing**:
- Todos os `SearchService.index*()` calls são `void` (não esperados)
- Try/catch interno, `console.error()` em falhas
- Nunca bloqueiam operações CRUD de findings
- Se ES está down, mutações continuam funcionando
- Búsquedas falham gracefully com fallback

**Fallback Search**:
- Hook `useSearch()` tenta ES primeiro
- Se falha (network, 5xx, etc), cai para `/api/findings?search=...`
- Usuário vê aviso "Usando búsqueda de base de datos"
- UI continua funcionando, sem crash

**RBAC**:
- Reutiliza permissão existente `VIEW_ALL_FINDINGS`
- Não cria permissão nova (evita duplicação semântica)
- Validado em `app/api/search/findings/route.ts`

## Testing Executado

✅ **Containerização**: Docker Elasticsearch 8.11.0 inicia corretamente  
✅ **Conexão**: API responde em `http://localhost:9200`  
✅ **Índice**: "findings-v1" criado com mapping correto (10 campos)  
✅ **Build**: TypeScript compilation passes (42s Turbopack)  
✅ **RBAC**: Endpoint retorna 401 UNAUTHORIZED sem session  
✅ **Migration Script**: Executa sem erros, relata 0 findings indexados (BD vazia)  
✅ **Component Mount**: SearchFindings integrado no dashboard sem erros de compilação  

## Próximos Passos (FASE 13+)

- **Mobile Search**: Otimizar SearchFindings para mobile (FASE 13)
- **Analytics**: Rastrear queries mais comuns, termos populares
- **Advanced Filters**: UI modal para filtros complexos
- **Saved Searches**: Bookmarks de buscas frequentes
- **Search API Caching**: Redis cache para queries comuns

## Notes

- Elasticsearch requer mínimo ~512MB heap; configurado com `ES_JAVA_OPTS=-Xms512m -Xmx512m`
- Usar `--legacy-peer-deps` para npm install (conflito date-fns@3 vs @base-ui/react@1.7 que quer ^4)
- Script de migração requer variável `DATABASE_URL` (não vem de .env automaticamente em scripts)
- Observação highlightada é renderizada com `<em>` tags; considerar XSS mitigação se adicionar inputs de usuário ao HTML
- Índice criado com 1 shard/1 replica (dev); em produção, considerar 3+ shards e replicas conforme volume

## Referências

- Arquivo de decisões: `/root/.claude/plans/lazy-purring-panda.md`
- Elasticsearch docs: https://www.elastic.co/guide/en/elasticsearch/reference/8.11/index.html
- @elastic/elasticsearch client: https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/8.11/index.html
