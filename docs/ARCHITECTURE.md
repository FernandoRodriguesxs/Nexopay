# NexoPay — Arquitetura

> Documentos relacionados: [PRD.md](PRD.md) · [DOMAIN.md](DOMAIN.md) · [CLAUDE.md](../CLAUDE.md)

A NexoPay é um **modular monolith** em TypeScript. Um único deployable de API (com um processo
separado de workers, mesmo código) e três frontends Next.js. Sem microservices, sem Kubernetes,
sem infraestrutura além de PostgreSQL e Redis.

---

## 1. Princípios

1. **Correção antes de tudo.** Dinheiro em centavos inteiros, efeitos financeiros idempotentes, invariantes garantidas no banco.
2. **O domínio manda.** Regras de negócio vivem no domínio; controllers, repositories e providers apenas traduzem.
3. **Responsabilidades pequenas.** Um use case por operação. Nada de `PaymentService` com 40 métodos.
4. **Abstração só com motivo.** Uma interface existe quando há mais de uma implementação real ou prevista (ex.: `PixProvider`) ou quando isola infraestrutura de teste (repositories). Caso contrário, código direto.
5. **Explícito > mágico.** Contexto de tenant passado explicitamente; sem estado global implícito para regras.

### Camadas

```text
Controller            (HTTP: parse, auth, validação de formato, serialização)
    ↓
Application / Use Case (orquestra: carrega, chama domínio, persiste, emite eventos)
    ↓
Domain                (entidades, value objects, state machines, invariantes — TS puro)
    ↓
Repository / Provider (portas: interfaces definidas pela aplicação)
    ↓
Infrastructure        (Prisma, Redis, BullMQ, HTTP clients, SandboxPixProvider)
```

| Camada     | Pode                                                                    | Não pode                                                      |
| ---------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| Controller | Validar formato (Zod), montar input, chamar 1 use case, mapear resposta | Regra de negócio, acessar Prisma, decidir transições          |
| Use case   | Orquestrar repositórios/providers, abrir unit of work                   | Conhecer HTTP, Prisma ou BullMQ diretamente                   |
| Domain     | Invariantes, transições, cálculos                                       | Importar Nest, Prisma, Redis, `fetch`, `Date.now()` implícito |
| Repository | Persistir/carregar agregados filtrando por tenant                       | Decidir regra (ex.: "se PAID então...")                       |
| Provider   | Traduzir domínio ⇄ API externa, reportar fatos                          | Mudar estado do domínio, decidir regras                       |

---

## 2. Monorepo

```text
apps/
  api/          NestJS — API pública, API do dashboard, workers (BullMQ)
  dashboard/    Next.js — dashboard do merchant
  checkout/     Next.js — checkout hospedado (pay.nexopay.com/p/:paymentId)
  docs/         Next.js + MDX — documentação developer-first
packages/
  config/       Presets TS/ESLint + schemas de env (Zod) + parseEnv
  contracts/    Schemas Zod e tipos da API pública (request/response, enums, IDs, erros)
  database/     Prisma schema, migrations, client factory
  logger/       pino com redaction
  sdk/          @nexopay/sdk (publicável, ESM + CJS)
  ui/           Componentes do Design System (React, Tailwind v4, shadcn/ui)
```

### Regras de dependência

```text
apps/*  ──►  packages/*          (nunca o contrário)
sdk     ──►  contracts           (embutido no bundle publicado)
api     ──►  contracts, database, logger, config
dashboard/checkout ──► contracts, ui, config
contracts ──► zod                (sem regra de negócio, sem I/O)
```

- `contracts` define **formato** (o que a API aceita e devolve). **Regra** (o que é permitido) fica no domínio da API.
- `ui` é _source-only_ (transpilado pelos apps Next via `transpilePackages`). Demais pacotes compilam para `dist/` com `tsc` (ESM); o SDK usa `tsup` (ESM + CJS).
- Versões centralizadas no `catalog` do `pnpm-workspace.yaml`.
- Turborepo orquestra `build → typecheck/lint/test` respeitando o grafo (`dependsOn: ["^build"]`).

### Runtime e toolchain

| Item       | Escolha                                          | Motivo                                                                |
| ---------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| Node       | 24 LTS                                           | Node 20 em EOL; pnpm baixa o runtime via `devEngines.runtime`.        |
| TypeScript | 6.0 (strict)                                     | TS 7 ainda incompatível com typescript-eslint e Nest CLI.             |
| Módulos    | ESM em todo o monorepo                           | NestJS 12 é ESM nativo; imports relativos com extensão `.js`.         |
| Testes     | Vitest (+ SWC na API)                            | Um runner para tudo; SWC preserva metadata de decorators do Nest.     |
| Lint       | ESLint 9 + typescript-eslint `strictTypeChecked` | `no-explicit-any`, `ban-ts-comment`, `no-console`, promises tratadas. |

---

## 3. Módulos da API

```text
apps/api/src/
  main.ts                 # processo HTTP
  worker.ts               # processo de workers (BullMQ) — mesmo código, outro entrypoint
  app.module.ts
  shared/
    ids/                  # generateId('pay') → pay_<ULID>
    errors/               # AppError + códigos + exception filter
    http/                 # request-id middleware, logging interceptor, zod pipe, paginação
    auth/                 # guards, AuthContext, decorators
    database/             # PrismaService, UnitOfWork (AsyncLocalStorage)
    queue/                # conexões BullMQ, nomes de filas
    crypto/               # hashing de API key, scrypt, AES-GCM, HMAC
  modules/
    health/
    auth/                 # signup, login, logout, sessões
    merchants/
    api-keys/
    customers/
    payments/
    sandbox/              # simulator (/v1/test/*)
    webhooks/             # endpoints, eventos, deliveries, workers
    developer-logs/       # ApiRequest
    audit/                # AuditLog
```

Estrutura interna de um módulo (exemplo `payments`):

```text
payments/
  domain/
    payment.ts                    # entidade + state machine (TS puro)
    payment.errors.ts
    payment.events.ts             # PaymentCreated, PaymentPaid
  application/
    create-payment.use-case.ts
    confirm-sandbox-payment.use-case.ts
    get-payment.use-case.ts
    list-payments.use-case.ts
    ports.ts                      # PaymentRepository, PixProvider (+ tokens de DI)
  infrastructure/
    prisma-payment.repository.ts
    sandbox-pix.provider.ts
  http/
    payments.controller.ts
    payment.presenter.ts          # entidade → contrato público
  payments.module.ts
```

- Use cases são classes com um único método público `execute(input)`.
- O domínio não usa decorators do Nest; o módulo Nest apenas faz o _wiring_.
- Módulos se comunicam via use cases exportados ou eventos — nunca acessando o repositório do outro.

---

## 4. Fluxo HTTP

```text
Request
  │
  ├─ RequestIdMiddleware     gera req_<ULID>; header X-Request-Id
  ├─ Helmet / CORS / body limit (100 kb)
  ├─ AuthGuard               API Key ou sessão → AuthContext (merchantId, environment, actor)
  ├─ ZodValidationPipe       valida body/query/params com schemas de @nexopay/contracts
  ├─ Controller              monta input → use case
  │     └─ UseCase → Domain → Repository/Provider → Infrastructure
  ├─ Presenter               entidade → contrato público
  ├─ ApiRequestInterceptor   registra Developer Log (após a resposta, assíncrono)
  └─ ExceptionFilter         qualquer erro → contrato de erro padrão
```

### 4.1 Contrato da API

- JSON em **camelCase**; datas ISO 8601 UTC; valores em **centavos inteiros**.
- Todo recurso tem `id` e `object` (`"payment"`, `"customer"`, ...).
- Listas: `GET /v1/payments?limit=20&startingAfter=pay_...` →
  `{ "object": "list", "data": [...], "hasMore": true }`. Ordenação: mais recentes primeiro.
- `metadata`: até 20 chaves, valores string ≤ 500 caracteres.
- Schemas Zod em modo estrito: campos desconhecidos são rejeitados.

### 4.2 Contrato de erro

```json
{
  "error": {
    "code": "IDEMPOTENCY_CONFLICT",
    "message": "This Idempotency-Key was already used with a different payload.",
    "requestId": "req_01J9Z...",
    "details": [{ "path": "amount", "message": "Expected integer" }]
  }
}
```

| HTTP | Código(s)                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`                                                                                                        |
| 401  | `UNAUTHENTICATED`, `INVALID_API_KEY`, `API_KEY_REVOKED`, `INVALID_CREDENTIALS`                                            |
| 403  | `FORBIDDEN`, `SANDBOX_ONLY`                                                                                               |
| 404  | `RESOURCE_NOT_FOUND`, `ROUTE_NOT_FOUND`                                                                                   |
| 409  | `IDEMPOTENCY_CONFLICT`, `IDEMPOTENCY_IN_PROGRESS`, `INVALID_PAYMENT_STATE`, `PAYMENT_EXPIRED`, `EMAIL_ALREADY_REGISTERED` |
| 429  | `RATE_LIMITED`                                                                                                            |
| 500  | `INTERNAL_ERROR` (mensagem genérica; detalhes só no log com o `requestId`)                                                |

Erros de domínio são classes tipadas (`PaymentExpiredError`) mapeadas para códigos no filter. Stack traces nunca vão para a resposta.

---

## 5. Autenticação

Dois tipos de credencial, um único `AuthContext`:

```ts
type AuthContext = {
  requestId: string;
  merchantId: string; // mer_...
  environment: 'SANDBOX' | 'PRODUCTION';
  actor:
    { type: 'api_key'; apiKeyId: string } | { type: 'user'; userId: string; role: MerchantRole };
};
```

### 5.1 API Key (API pública)

- Header: `Authorization: Bearer sk_test_...`.
- Formato: `sk_test_` + 32 bytes aleatórios em base62.
- Armazenamento: `hash = HMAC-SHA256(API_KEY_PEPPER, key)` com índice único → lookup O(1).
  Keys têm 256 bits de entropia, então hash lento (bcrypt/argon2) não agrega segurança e impediria o lookup determinístico.
- O ambiente vem do prefixo e é conferido contra o ambiente armazenado.
- `lastUsedAt` atualizado com throttling (no máximo 1×/min por key).

### 5.2 Sessão (dashboard)

- `POST /v1/auth/signup | login | logout`, `GET /v1/auth/me`.
- Senha: `scrypt` (`node:crypto`, parâmetros OWASP, salt por usuário).
- Sessão: token de 32 bytes no cookie `np_session` (`HttpOnly`, `Secure` em produção, `SameSite=Lax`); no banco apenas `SHA-256(token)`. Expiração com renovação deslizante.
- Merchant ativo: header `X-NexoPay-Merchant: mer_...` (membership verificada a cada request).
- Ambiente no dashboard: header `X-NexoPay-Environment` (padrão `SANDBOX`; `PRODUCTION` rejeitado no MVP).
- CSRF: `SameSite=Lax` + verificação de `Origin` contra allowlist em requests mutáveis com sessão.

### 5.3 Matriz de acesso

| Rotas                                                                |         API Key         | Sessão |
| -------------------------------------------------------------------- | :---------------------: | :----: |
| `/v1/customers`, `/v1/payments`, `/v1/webhook-endpoints`             |           ✅            |   ✅   |
| `/v1/test/payments/:id/confirm` (sandbox)                            |           ✅            |   ✅   |
| `/v1/api-keys` (criar, listar, revogar)                              |           ❌            |   ✅   |
| `/v1/auth/*`, `/v1/merchants/*`                                      |           ❌            |   ✅   |
| `/v1/dashboard/*` (read models internos: overview, logs, deliveries) |           ❌            |   ✅   |
| `/v1/checkout/payments/:id` (projeção pública mínima)                | público, com rate limit |   —    |
| `/health`, `/health/ready`                                           |         público         |   —    |

> Uma API Key **não** gerencia API Keys: evita escalonamento caso uma key vaze.
> Rotas `/v1/dashboard/*` e `/v1/checkout/*` são internas — não fazem parte do contrato público nem do SDK.

---

## 6. Multi-tenancy

- Isolamento lógico por `merchantId` + `environment` em **todas** as tabelas de tenant.
- Repositórios recebem um `TenantScope { merchantId, environment }` **obrigatório** em todo método:

  ```ts
  findById(scope: TenantScope, id: PaymentId): Promise<Payment | null>
  ```

  Não existe `findById(id)` sem escopo para recursos de tenant.

- Índices compostos começam por `(merchantId, environment, ...)`.
- Relações cruzadas (ex.: `customerId` em Payment) são validadas no mesmo escopo.
- Recurso de outro tenant → **404** `RESOURCE_NOT_FOUND`.
- Testes de integração dedicados para cada recurso (Merchant A não lê/altera dados do Merchant B).
- Futuro: Row Level Security no PostgreSQL como defesa em profundidade.

---

## 7. Payment state machine

```text
PENDING ──► PAID ──► REFUNDED (futuro)
   │
   ├──► FAILED
   └──► EXPIRED
```

- Implementada na entidade `Payment` (domínio). Cada transição é um método (`markPaid(at)`, `expire(at)`, ...) que valida o estado atual e registra um evento de domínio.
- Transição para o mesmo estado = **no-op** (sem eventos), base da idempotência da confirmação.
- No banco, a transição é aplicada com **update condicional**:

  ```sql
  UPDATE payment SET status = 'PAID', paid_at = $now
  WHERE id = $id AND merchant_id = $m AND environment = $e AND status = 'PENDING';
  ```

  0 linhas afetadas ⇒ outra requisição venceu a corrida ⇒ recarrega e responde de forma idempotente.

- Expiração no MVP é **lazy**: ao confirmar/consultar um Payment `PENDING` com `expiresAt` vencido, ele passa a `EXPIRED`. Expiração ativa (job agendado) e o evento `payment.expired` entram na fase 1.1.

---

## 8. Idempotência

Aplicada a `POST /v1/payments` (header `Idempotency-Key`, até 255 caracteres; o SDK gera automaticamente).

### Tabela `IdempotencyKey`

`(merchantId, environment, key)` único · `requestHash` (SHA-256 de método + rota + body canônico) ·
`status` (`IN_PROGRESS` | `COMPLETED`) · `resourceId` (ID reservado, ex.: `pay_...`) ·
`responseStatus` · `responseBody` · `lockedAt` · `expiresAt` (24 h).

### Algoritmo

```text
1. INSERT ... ON CONFLICT DO NOTHING          (adquire a key; reserva resourceId = pay_<ULID>)
2a. Inseriu → executa o use case com o resourceId reservado
      sucesso / erro 4xx de negócio → grava resposta, status = COMPLETED
      erro inesperado (5xx)         → apaga a key (cliente pode tentar de novo)
2b. Já existia →
      requestHash diferente               → 409 IDEMPOTENCY_CONFLICT
      COMPLETED                           → devolve resposta gravada (+ Idempotent-Replayed: true)
      IN_PROGRESS e lock recente (< 60 s) → 409 IDEMPOTENCY_IN_PROGRESS
      IN_PROGRESS e lock expirado         → retoma (UPDATE condicional em lockedAt) com o mesmo resourceId
```

- **Concorrência:** a constraint única garante um único vencedor no passo 1; não há janela de corrida.
- O `resourceId` reservado é repassado ao provider como referência externa, então um retry após falha parcial não cria uma segunda cobrança no provider.
- Sem `Idempotency-Key`, o request é processado normalmente (o SDK sempre envia).
- A confirmação sandbox é idempotente pelo próprio estado (§7) e pela constraint única de Transaction.

---

## 9. Provider abstraction

```ts
// application/ports.ts — a aplicação define a porta
interface PixProvider {
  createPix(input: CreatePixInput): Promise<PixResult>;
}

interface CreatePixInput {
  paymentId: string; // referência externa idempotente
  amount: number; // centavos
  description?: string;
  expiresAt: Date;
}

interface PixResult {
  provider: string; // 'sandbox'
  providerReference: string; // único por provider
  brCode: string; // copia-e-cola
  expiresAt: Date;
}
```

- `SandboxPixProvider` (infraestrutura) gera um BR Code EMV com GUI `com.nexopay.sandbox` e CRC16 válido, porém **não pagável** em bancos reais.
- QR Code gerado a partir do `brCode` na borda (API devolve imagem base64 / frontends renderizam).
- O provider **reporta fatos**; o domínio decide. Futuros webhooks de PSP real serão normalizados em comandos internos (ex.: `MarkPaymentPaid`) — o mesmo use case usado pelo simulator.
- Nenhum tipo de provider vaza para o domínio ou para o contrato público.
- Escolha de provider real: **decisão de negócio pendente** (PRD §11).

---

## 10. Webhooks

```text
Use case (UnitOfWork)
  ├─ altera estado (Payment PAID)
  ├─ cria Transaction
  └─ grava WebhookEvent (outbox)      ← mesma transação do PostgreSQL
        │ após o commit
        ▼
  fila webhook-fanout   (jobId = fanout:<evt>)
        │ worker
        ▼
  para cada endpoint ENABLED inscrito no tipo → fila webhook-delivery (attempt 1)
        │ worker
        ▼
  POST no endpoint do merchant → grava WebhookDelivery (1 linha por tentativa)
        │ falhou e attempt < máx
        ▼
  agenda attempt N+1 com atraso (backoff)
```

- **Nunca** há chamada HTTP ao merchant dentro do request que gerou o evento.
- **Outbox:** se o processo cair entre o commit e o enqueue, uma varredura periódica (a cada 60 s) re-enfileira eventos com `dispatchedAt IS NULL` há mais de 30 s.
- **Idempotência dos workers:** `dispatchedAt` + constraint única `(eventId, endpointId, attempt)` em WebhookDelivery tornam jobs duplicados inofensivos.
- **Retry:** 8 tentativas — imediata, +1 min, +5 min, +30 min, +2 h, +6 h, +12 h, +24 h (~45 h no total).
- **Entrega:** timeout 10 s, sem seguir redirects, corpo de resposta truncado em 2 KB, `User-Agent: NexoPay-Webhooks/1.0`.
- **SSRF:** a URL é resolvida e bloqueada se apontar para IP privado, loopback, link-local ou metadata de cloud (exceto em `NODE_ENV=development`).

### 10.1 Payload

```json
{
  "id": "evt_01J9Z...",
  "object": "event",
  "type": "payment.paid",
  "environment": "SANDBOX",
  "createdAt": "2026-10-03T12:00:00.000Z",
  "data": {
    "object": { "id": "pay_01J9Z...", "object": "payment", "status": "PAID", "amount": 1990 }
  }
}
```

### 10.2 Assinatura (HMAC SHA-256)

```text
X-NexoPay-Event-Id:  evt_01J9Z...
X-NexoPay-Timestamp: 1791028800                      (unix, segundos)
X-NexoPay-Signature: v1=<hex(HMAC_SHA256(secret, "<timestamp>.<rawBody>"))>
```

- Cada tentativa é assinada com um timestamp novo.
- Formato `v1=` permite múltiplas assinaturas separadas por vírgula durante rotação de secret.
- **Anti-replay (lado do merchant, via SDK `verifyWebhook`)**: rejeita timestamp fora da tolerância (padrão 300 s), compara com `timingSafeEqual`, e recomenda deduplicar por `X-NexoPay-Event-Id`.
- O `secret` do endpoint é armazenado com **AES-256-GCM** (`SECRETS_ENCRYPTION_KEY`), pois precisa ser recuperável para assinar — hash não serviria.

---

## 11. BullMQ

| Fila               | Job                                                                            | Idempotência                                    |
| ------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------- |
| `webhook-fanout`   | `{ eventId }`                                                                  | `jobId = fanout:<eventId>` + `dispatchedAt`     |
| `webhook-delivery` | `{ eventId, endpointId, attempt }`                                             | `jobId = dlv:<evt>:<whk>:<n>` + unique no banco |
| `maintenance`      | varredura do outbox, limpeza de idempotency keys e logs expirados (repeatable) | seguro por natureza                             |

- Workers rodam em `apps/api/src/worker.ts` (Nest application context, sem HTTP). Mesmo código e imagem da API; processo separado para que entregas lentas não afetem a latência da API.
- O retry é modelado como **um job por tentativa** com `delay`, porque cada tentativa é um registro de `WebhookDelivery` com backoff próprio.
- Jobs concluídos são removidos (`removeOnComplete`); falhas mantidas por tempo limitado para inspeção.
- Shutdown gracioso: workers terminam o job corrente antes de encerrar.

## 12. Redis

- Usos: **backend do BullMQ** e **contadores de rate limit**.
- **Não** é fonte de verdade de nada financeiro (idempotência, estados e eventos vivem no PostgreSQL).
- Prefixos: `nexopay:bull:*`, `nexopay:ratelimit:*`.
- Produção exige `maxmemory-policy noeviction` (requisito do BullMQ).

## 13. Transações PostgreSQL

- **Unit of Work** com `AsyncLocalStorage`: o use case chama `unitOfWork.run(async () => {...})`; os repositórios usam automaticamente o client transacional corrente. É a única abstração de persistência transversal.
- Isolamento `READ COMMITTED` + **updates condicionais** e **constraints únicas** como mecanismo de concorrência (sem locks longos).
- Transações curtas: **nenhuma chamada de rede** (provider, webhook) dentro de uma transação.
- Constraints que protegem invariantes financeiras:
  - `Transaction (paymentId, type)` único;
  - `IdempotencyKey (merchantId, environment, key)` único;
  - `WebhookDelivery (eventId, endpointId, attempt)` único;
  - `ApiKey (hash)` único; `PixPayment (provider, providerReference)` único.
- Valores monetários: `INTEGER` (valores unitários) e `BIGINT` (agregados). Nunca `REAL`/`DOUBLE`/`NUMERIC` para dinheiro.
- Migrations via `prisma migrate`; sempre revisadas antes de aplicar.

---

## 14. Observabilidade

- **Logs:** pino JSON em stdout com `service`, `requestId`, `merchantId`, `environment`, rota, status e duração. Redaction de `authorization`, cookies, secrets, tokens, senhas, `taxId`, `email`.
- **Nunca** `console.log` (regra de lint `no-console`).
- **Request ID:** `req_<ULID>` em todo request (header `X-Request-Id`, corpo de erro, log, Developer Log).
- **Developer Logs (`ApiRequest`):** método, path, status, duração, ator, `Idempotency-Key`, código de erro, corpos redigidos e truncados (8 KB). Gravado após a resposta, sem impactar latência; falha ao gravar não quebra o request. Retenção: 30 dias.
- **Health:** `/health` (liveness) e `/health/ready` (PostgreSQL + Redis).
- **Futuro:** OpenTelemetry (traces + métricas), métricas de filas, alertas de taxa de falha de webhooks.

## 15. Audit logs

- Ações auditadas: `user.signed_up`, `user.logged_in`, `api_key.created`, `api_key.revoked`, `webhook_endpoint.created`, `webhook_endpoint.updated`, `payment.sandbox_confirmed`, `merchant.updated`.
- Campos: ator (`USER` | `API_KEY` | `SYSTEM`), ação, recurso, metadata redigida, IP, user-agent, `requestId`, data.
- Gravado na **mesma transação** da ação auditada.
- Append-only: o repositório não expõe update/delete (futuro: `REVOKE UPDATE, DELETE` no banco).

## 16. Segurança

| Tema               | Medida                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------- |
| API Keys           | HMAC-SHA256 + pepper; exibição única; revogação imediata; dica `sk_test_…a1b2`.          |
| Senhas             | scrypt com salt; mensagens de login genéricas; rate limit em login/signup.               |
| Sessões            | Token aleatório, hash no banco, cookie HttpOnly/Secure/SameSite=Lax, logout server-side. |
| Secrets de webhook | AES-256-GCM com chave versionada (permite rotação).                                      |
| Secrets de infra   | Somente via environment; validados no boot; nunca logados; `.env` fora do git.           |
| Entrada            | Zod estrito na borda; limite de body 100 KB; IDs validados por prefixo.                  |
| Saída              | Sem stack traces; projeção pública mínima no checkout (sem PII).                         |
| HTTP               | Helmet, CORS com allowlist (dashboard/checkout), HSTS em produção.                       |
| SSRF               | Bloqueio de IPs internos nas URLs de webhook; sem redirects.                             |
| Rate limiting      | Por API Key e por IP (Redis); mais restrito em auth e checkout público.                  |
| Logs               | Redaction centralizada no `@nexopay/logger`.                                             |
| Dados pessoais     | Minimização; `taxId`/`email` fora de logs; retenção a definir (LGPD — PRD §11).          |
| Dependências       | Versões fixas via catalog; `pnpm audit` no CI.                                           |

## 17. Sandbox

- Ambiente derivado da credencial; dados sandbox e produção totalmente separados.
- BR Code sandbox **não pagável** (GUI próprio, sem chave PIX real).
- Simulator em `/v1/test/*`, protegido por `SandboxOnlyGuard` (`403 SANDBOX_ONLY` fora do sandbox).
- O simulator chama o **mesmo use case** de confirmação que um provider real usaria — o fluxo testado é o fluxo de produção.
- Dashboard exibe **SANDBOX** permanentemente; checkout sandbox exibe aviso de ambiente de teste.

## 18. Estratégia futura de Ledger

1. Introduzir `LedgerAccount` e `LedgerEntry` (partidas dobradas, `BIGINT`, imutáveis).
2. Cada `Transaction` passa a gerar lançamentos na **mesma unit of work** (ex.: `PAYMENT` → crédito em `merchant:pending`, débito em `nexopay:clearing`).
3. `Balance` derivado por soma de lançamentos; materialização incremental para leitura rápida, sempre reconciliável com o ledger.
4. Refund e Payout validam saldo a partir do ledger, dentro de transação, com lock no saldo materializado.
5. Reconciliação diária contra extratos do provider real.

Até lá, `Transaction` é o registro financeiro de verdade e já nasce imutável e única por Payment, o que torna a migração aditiva.

---

## 19. Frontends

- **Dashboard:** Server Components para o render inicial + TanStack Query em componentes cliente. Cliente HTTP tipado com `@nexopay/contracts`. **Sem regra de negócio no React**: o que é permitido vem da API (ex.: o botão "Simular pagamento" aparece porque a API indica `status = PENDING` e ambiente sandbox; a decisão real acontece no backend).
- **Checkout:** server-rendered; polling do endpoint público a cada 3 s até estado terminal; sem dados pessoais.
- **Docs:** Next.js + MDX; exemplos usando o SDK.
- Todos seguem o Design System em `.claude/skills/nexopay-design` (tokens importados por `@nexopay/ui`).

## 20. Testes

| Nível      | Escopo                                                    | Infra                       |
| ---------- | --------------------------------------------------------- | --------------------------- |
| Unitário   | Domínio (state machine, dinheiro, assinatura HMAC, IDs)   | Nenhuma                     |
| Aplicação  | Use cases com fakes em memória                            | Nenhuma                     |
| Integração | Repositórios, idempotência sob concorrência, constraints  | PostgreSQL (`nexopay_test`) |
| E2E da API | HTTP completo com Supertest                               | PostgreSQL + Redis          |
| Webhooks   | Worker contra servidor HTTP local (sucesso, falha, retry) | PostgreSQL + Redis          |

Casos obrigatórios: Payment criado · Payment inválido · Merchant errado · API Key inválida · API Key revogada ·
Idempotency retry · Idempotency conflict · Payment confirm · Payment confirm duplicado (inclusive concorrente) ·
Webhook signature · Webhook retry.

---

## 21. Decisões técnicas (resumo)

| #   | Decisão                                                           | Alternativa descartada                    |
| --- | ----------------------------------------------------------------- | ----------------------------------------- |
| 1   | Modular monolith (API + worker do mesmo código)                   | Microservices                             |
| 2   | Node 24 LTS, TS 6 strict, ESM                                     | Node 20 (EOL), TS 7 (ecossistema imaturo) |
| 3   | NestJS 12 + Prisma 7 (`@prisma/adapter-pg`)                       | —                                         |
| 4   | Zod (contracts) para validação na API                             | class-validator (duplicaria os schemas)   |
| 5   | ID público prefixado (`pay_<ULID>`) como chave primária           | UUID interno + coluna pública             |
| 6   | Coluna `environment` em todos os recursos de tenant               | Bancos separados por ambiente             |
| 7   | API Key com HMAC-SHA256 + pepper                                  | bcrypt/argon2 (impede lookup)             |
| 8   | Senhas com scrypt (`node:crypto`)                                 | Dependência nativa de argon2              |
| 9   | Unit of Work via AsyncLocalStorage                                | Passar `tx` manualmente por toda a cadeia |
| 10  | Outbox transacional + BullMQ, um job por tentativa de webhook     | Envio síncrono / retry só em memória      |
| 11  | Idempotência no PostgreSQL                                        | Redis (sem garantia transacional)         |
| 12  | Tokens de design canônicos na skill, importados por `@nexopay/ui` | Cópias divergentes por app                |
| 13  | Docs com Next.js + MDX                                            | Plataforma hospedada de docs              |
