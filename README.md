# NexoPay

Infraestrutura brasileira de pagamentos **developer-first**. Primeiro método: **PIX** (sandbox).

> Antes de contribuir, leia o [CLAUDE.md](CLAUDE.md) e os documentos em [docs/](docs/).

## Stack

| Camada      | Tecnologia                                                              |
| ----------- | ----------------------------------------------------------------------- |
| Monorepo    | pnpm workspaces + Turborepo + TypeScript 6 (strict, ESM)                |
| API         | NestJS 12, Prisma 7, PostgreSQL 17, Redis 7, BullMQ                     |
| Frontends   | Next.js 16 (App Router), Tailwind v4, shadcn/ui, Lucide, TanStack Query |
| Validação   | Zod 4                                                                   |
| Logs        | pino (JSON estruturado, redaction de secrets)                           |
| Testes      | Vitest (+ SWC para decorators do Nest), Supertest                       |
| Lint/format | ESLint 9 (typescript-eslint strict type-checked) + Prettier             |

## Estrutura

```text
apps/
  api/         API pública e backend principal (NestJS)            :4000
  dashboard/   Dashboard do merchant (Next.js)                     :3000
  checkout/    Checkout hospedado — pay.nexopay.com/p/:paymentId   :3001
  docs/        Documentação developer-first (Next.js + MDX)        :3002
packages/
  config/      Presets TS/ESLint + validação de env (Zod)
  contracts/   Tipos e schemas compartilhados (sem regra de negócio)
  database/    Prisma schema, migrations e client
  logger/      Logging estruturado
  sdk/         @nexopay/sdk (ESM + CJS)
  ui/          Componentes do Design System
docs/          PRD, arquitetura e domínio
infra/         Arquivos de apoio à infra local (docker compose)
```

## Requisitos

- **pnpm 10** — o projeto usa Node **24 LTS**. Se sua máquina tiver outra versão, o pnpm
  baixa e usa o Node 24 automaticamente nos scripts (via `devEngines.runtime`).
- **Docker** — para PostgreSQL e Redis locais.

## Primeiros passos

```bash
cp .env.example .env     # variáveis locais (nunca versionar o .env)
pnpm install
pnpm infra:up            # PostgreSQL + Redis (docker compose)
pnpm db:generate         # gera o Prisma Client
pnpm dev                 # sobe todos os apps em modo watch
```

## Scripts

| Comando              | Descrição                                   |
| -------------------- | ------------------------------------------- |
| `pnpm dev`           | Todos os apps/pacotes em modo watch         |
| `pnpm build`         | Build de tudo (respeitando o grafo de deps) |
| `pnpm typecheck`     | `tsc --noEmit` em todos os workspaces       |
| `pnpm lint`          | ESLint em todos os workspaces               |
| `pnpm test`          | Vitest em todos os workspaces               |
| `pnpm format`        | Prettier (escrita)                          |
| `pnpm check`         | format + lint + typecheck + test + build    |
| `pnpm db:migrate`    | `prisma migrate dev`                        |
| `pnpm db:studio`     | Prisma Studio                               |
| `pnpm infra:up/down` | Sobe/derruba PostgreSQL e Redis locais      |

Para rodar algo em um único workspace: `pnpm --filter @nexopay/api test`.
