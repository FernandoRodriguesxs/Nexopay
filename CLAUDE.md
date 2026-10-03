# CLAUDE.md — Instruções permanentes para agentes

NexoPay é uma infraestrutura brasileira de pagamentos **developer-first**. Primeiro método: PIX.
Estado atual: **MVP sandbox** — nenhum dinheiro real é movimentado.

## Antes de implementar, leia

```text
docs/PRD.md
docs/ARCHITECTURE.md
docs/DOMAIN.md
.claude/skills/nexopay-design/SKILL.md
```

Se uma tarefa contradiz esses documentos, **pare e pergunte**. Se você mudar uma decisão
documentada, atualize o documento no mesmo trabalho.

## Prioridades (nesta ordem)

1. Correção
2. Segurança
3. Simplicidade
4. Developer experience
5. Observabilidade
6. Performance

## Regras de código

- TypeScript **strict**. Sem `any`. Sem `@ts-ignore` / `@ts-nocheck` (use `@ts-expect-error` com justificativa apenas em último caso).
- SOLID e Clean Code: **funções pequenas**, nomes explícitos, **early return**, sem `else` após `return`.
- Um use case por operação (`CreatePaymentUseCase.execute`). Evite services gigantes.
- **Não crie abstrações sem necessidade.** Interface só quando há mais de uma implementação real/prevista ou para isolar infraestrutura.
- **Sem regra de negócio em Controllers.** Controller valida formato, chama um use case, apresenta a resposta.
- **Sem regra de negócio em React.** Frontends exibem o que a API decide.
- **Sem regra de negócio em Repositories ou Providers.** Eles persistem/traduzem; o domínio decide.
- Nunca `console.log` — use `@nexopay/logger`.
- ESM: imports relativos com extensão `.js` nos pacotes Node/API.
- Validação na borda com Zod (schemas em `@nexopay/contracts`).
- `@nexopay/contracts` contém apenas formatos (schemas/tipos), nunca regras.

## Regras financeiras (inegociáveis)

- **Dinheiro sempre em centavos inteiros.** Nunca `float` para dinheiro. Nunca `Decimal`/`Float` no Prisma para valores monetários.
- Formatação `R$` só na borda, a partir do inteiro, sem aritmética de ponto flutuante.
- **Payment ≠ Transaction.** Transaction só existe quando há movimentação efetiva.
- **Operações financeiras são idempotentes.** Retry e concorrência nunca podem duplicar efeitos.
- Invariantes financeiras protegidas também por **constraints no banco** (ex.: uma Transaction `PAYMENT` por Payment).
- Registros financeiros são imutáveis; correção = novo registro.
- Não conectar PSP/banco real. Não implementar dinheiro real. **Não tomar decisões financeiras ou regulatórias** (tarifas, limites, KYC, PSP) — registre como questão em aberto no PRD e pergunte.

## Segurança e multi-tenancy

- **Multi-tenancy por `merchantId`** (+ `environment`) em toda consulta de recurso de tenant. Nunca buscar recurso de tenant só por `id`.
  Repositórios recebem `TenantScope` obrigatório; o escopo vem da credencial, nunca do body.
- **Toda rota declara sua política de auth** (`@Public`, `@ApiKeyAuth`, `@SessionAuth`). Rota sem política é negada.
  API Key e sessão nunca são fallback uma da outra; API Keys não administram API Keys.
- Erros esperados: `AppError(code, ...)` com códigos de `@nexopay/contracts`. Nunca exponha mensagem de exceção desconhecida.
- Recurso de outro merchant → **404**.
- **API Keys nunca em plaintext**: armazene apenas o hash (HMAC + pepper); exiba a key uma única vez.
- **Secrets nunca em logs**: `Authorization`, cookies, API keys, secrets de webhook, senhas, tokens. Dados pessoais (`taxId`, `email`) também não.
- Secrets só via environment, validados por `@nexopay/config`.
- Nenhuma chamada HTTP externa (provider, webhook) dentro de transação de banco.

## UI

- **Toda UI segue o Design System** em `.claude/skills/nexopay-design` (leia `SKILL.md` e o guideline da área).
- Ícones: somente **Lucide**. Fontes: Geist / Geist Mono.
- Status nunca representado só por cor (sempre texto + ícone).
- Indicador **SANDBOX** sempre visível no dashboard.

## Fora de escopo (não implementar)

PSP real · cartão · boleto · subscriptions · split · marketplace · Open Finance · payout real ·
refund real · antifraude próprio · MCP · features de IA · microservices · Kubernetes ·
infraestrutura além de PostgreSQL + Redis.

## Comandos

```bash
pnpm install            # dependências (pnpm usa Node 24 automaticamente)
pnpm infra:up           # PostgreSQL + Redis (docker compose) — obrigatório para os testes da API
pnpm dev                # todos os apps
pnpm db:migrate         # aplica migrations no banco de desenvolvimento
pnpm check              # format + lint + typecheck + test + build — rode antes de concluir
pnpm --filter @nexopay/api test
```

## Definição de pronto

- [ ] Lint, typecheck, testes e build passando (`pnpm check`).
- [ ] Testes cobrindo o comportamento novo (domínio primeiro; multi-tenancy e idempotência quando aplicável).
- [ ] Nenhum secret/PII em logs; nenhum `any`; nenhum `console.log`.
- [ ] Documentação atualizada se uma decisão mudou.
