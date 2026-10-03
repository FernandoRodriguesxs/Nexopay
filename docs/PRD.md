# NexoPay — Product Requirements Document (PRD)

> Status: **MVP / Sandbox** · Última revisão: 2026-10-03
> Documentos relacionados: [DOMAIN.md](DOMAIN.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [Design System](../.claude/skills/nexopay-design/SKILL.md)

---

## 1. Visão

**NexoPay permite que desenvolvedores brasileiros integrem pagamentos de forma simples.**

Uma infraestrutura de pagamentos _developer-first_: API previsível, SDK tipado, sandbox
completo e documentação que leva do zero ao primeiro pagamento em minutos. A inspiração é a
simplicidade de produtos como AbacatePay; arquitetura, identidade e implementação são próprias.

### Fluxo central

```text
Criar conta
↓
Gerar API Key
↓
npm install @nexopay/sdk
↓
Criar Payment
↓
Gerar PIX
↓
Pagamento
↓
payment.paid
↓
Webhook
```

### North Star do MVP

> Um desenvolvedor deve conseguir realizar seu **primeiro pagamento SANDBOX em menos de 10 minutos**,
> contados a partir da criação da conta.

---

## 2. Problema

Integrar pagamentos no Brasil ainda é desnecessariamente difícil para quem desenvolve:

- **Onboarding lento**: contato comercial, formulários e aprovação antes de escrever a primeira linha de código.
- **APIs inconsistentes**: nomes, formatos de erro e paginação diferentes entre endpoints; valores ora em reais, ora em centavos.
- **Sandbox pobre**: ambientes de teste que não simulam o ciclo completo (pagamento confirmado, webhook entregue).
- **Webhooks opacos**: sem assinatura clara, sem histórico de entregas, sem retry visível.
- **Pouca observabilidade**: o desenvolvedor não consegue ver o que a API recebeu e respondeu.
- **Documentação genérica**: exemplos incompletos, sem SDK tipado.

## 3. Público

| Persona                         | Descrição                                                         | O que precisa                                         |
| ------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| **Dev indie / freelancer**      | Constrói SaaS, e-commerce pequeno ou projeto próprio.             | Começar em minutos, sem burocracia, SDK simples.      |
| **Dev de startup**              | Time pequeno, precisa cobrar via PIX rápido e com confiabilidade. | Webhooks confiáveis, idempotência, logs, ambientes.   |
| **Tech lead / CTO early-stage** | Avalia fornecedores de pagamento.                                 | Segurança, previsibilidade, clareza de estados/erros. |

**Fora do público inicial:** grandes varejistas, marketplaces com split, empresas que exigem
cartão/boleto, integrações com ERPs.

## 4. Objetivos

1. **Time-to-first-payment < 10 min** em sandbox.
2. **API previsível**: mesmos padrões em todos os recursos (IDs prefixados, erros, paginação, idempotência).
3. **Confiabilidade financeira desde o dia 1**: nenhuma duplicidade de efeito financeiro, mesmo sob retry e concorrência.
4. **Transparência para o dev**: todo request e toda entrega de webhook visíveis no dashboard.
5. **Base pronta para produção**: arquitetura que permita plugar um provider real sem reescrever o domínio.

### Não-objetivos (MVP)

- Movimentar dinheiro real.
- Escolher ou integrar um PSP/banco real.
- Tomar decisões regulatórias (licenças, KYC/KYB, limites legais).

## 5. Métricas

| Métrica                                   | Definição                                                         | Meta MVP |
| ----------------------------------------- | ----------------------------------------------------------------- | -------- |
| **Time to first sandbox payment (TTFP)**  | Mediana entre `user.created` e o primeiro `payment.paid` sandbox. | < 10 min |
| **Ativação**                              | % de contas que criam API Key **e** um Payment em 24h.            | > 40%    |
| **Webhook success rate**                  | % de WebhookEvents entregues com 2xx (até a última tentativa).    | > 99%    |
| **Webhook first-attempt latency (p95)**   | Tempo entre o evento e a 1ª tentativa de entrega.                 | < 5 s    |
| **API latency p95** (`POST /v1/payments`) | Latência do endpoint em sandbox.                                  | < 300 ms |
| **API error rate (5xx)**                  | % de requests com 5xx.                                            | < 0,1%   |
| **Duplicidade financeira**                | Transactions duplicadas para o mesmo Payment.                     | **0**    |

## 6. Escopo

### 6.1 MVP

| #   | Funcionalidade         | Resumo                                                                                    |
| --- | ---------------------- | ----------------------------------------------------------------------------------------- |
| 1   | **Auth**               | Cadastro e login de usuários (email + senha) para o dashboard. Sessão via cookie seguro.  |
| 2   | **Merchant**           | Conta da empresa/projeto. Criada no cadastro; usuário vira `OWNER`.                       |
| 3   | **API Keys**           | Criar (`sk_test_`), listar, revogar. Exibida **uma única vez**. Nunca armazenada inteira. |
| 4   | **Customer**           | Criar, listar e consultar pagadores.                                                      |
| 5   | **Payment**            | Criar, listar e consultar cobranças. Idempotente via `Idempotency-Key`.                   |
| 6   | **PIX Sandbox**        | BR Code fake (não pagável em bancos reais), QR Code, `expiresAt`, `providerReference`.    |
| 7   | **Sandbox Simulator**  | `POST /v1/test/payments/:id/confirm` simula a confirmação do PIX.                         |
| 8   | **Webhooks**           | Endpoints do merchant; eventos `payment.created` e `payment.paid`; assinatura HMAC.       |
| 9   | **Webhook deliveries** | Histórico de cada tentativa (status, latência, resposta) com retry automático.            |
| 10  | **Developer Logs**     | Todo request autenticado registrado com `requestId`, status e duração.                    |
| 11  | **Dashboard**          | Visão geral, payments, customers, developers (keys, webhooks, logs), settings.            |
| 12  | **Checkout**           | Página hospedada `pay.nexopay.com/p/:paymentId` com QR Code e status em tempo real.       |
| 13  | **SDK TypeScript**     | `@nexopay/sdk` com tipos, idempotência automática e verificação de webhooks.              |

### 6.2 Fora do MVP

Cartão · boleto · subscriptions · split · marketplace · Open Finance · múltiplos providers ·
payout real · refund real · antifraude próprio · MCP / features de IA · modo produção (`sk_live_`).

> `Refund`, `Payout`, `Ledger` e `Balance` são **documentados e modelados conceitualmente**
> (ver [DOMAIN.md](DOMAIN.md)), mas não têm implementação financeira no MVP.

---

## 7. Funcionalidades e critérios de aceitação

Formato: _Dado / Quando / Então_. Todos os critérios valem para o ambiente **SANDBOX**.

### 7.1 Auth

- **Cadastro**: dado um email não cadastrado e senha com no mínimo 10 caracteres, quando o usuário se cadastra, então são criados `User`, `Merchant` e `MerchantMember (OWNER)` e uma sessão é iniciada.
- Email já cadastrado → erro `EMAIL_ALREADY_REGISTERED` sem revelar dados da conta existente.
- **Login** com credenciais inválidas → `INVALID_CREDENTIALS` (mensagem genérica; mesma resposta para email inexistente e senha errada).
- Senhas armazenadas apenas como hash (scrypt); nunca logadas.
- Sessão em cookie `HttpOnly`, `Secure` (produção), `SameSite=Lax`; logout invalida a sessão no servidor.
- Tentativas de login com rate limit.

### 7.2 Merchant

- Todo recurso de negócio pertence a exatamente um Merchant (`merchantId`).
- Um usuário só acessa Merchants dos quais é membro.
- Acesso a recurso de outro Merchant retorna **404** (não 403), evitando enumeração.

### 7.3 API Keys

- Criar key gera `sk_test_<segredo>`; a resposta contém o valor completo **uma única vez**.
- Persistimos apenas: `id` (`key_...`), hash (HMAC-SHA256 com pepper), dica (`sk_test_…a1b2`), nome, ambiente, `createdAt`, `lastUsedAt`, `revokedAt`.
- Listagem nunca retorna o segredo.
- Revogar é imediato: requests seguintes com a key → `401 API_KEY_REVOKED`.
- Key inválida/inexistente → `401 INVALID_API_KEY`.
- Gerenciamento de API Keys exige **sessão do dashboard** (uma API Key não pode criar outra API Key).
- Toda criação/revogação gera `AuditLog`.

### 7.4 Customer

- `POST /v1/customers` com `name` obrigatório; `email`, `taxId` (CPF/CNPJ com dígitos verificadores válidos) e `phone` opcionais.
- `GET /v1/customers` paginado por cursor; `GET /v1/customers/:id` retorna 404 para outro Merchant.
- `taxId` e `email` nunca aparecem em logs.

### 7.5 Payment

- `POST /v1/payments` com `amount` (inteiro, centavos, ≥ 1 e ≤ limite técnico configurado), `method: "PIX"`, `description?`, `customerId?`, `metadata?`, `expiresIn?`.
- Valores não inteiros, negativos, zero ou acima do limite → `400 VALIDATION_ERROR`.
- Criado com status `PENDING` + dados PIX (BR Code, QR Code, `expiresAt`).
- Emite `payment.created`.
- **Idempotência**:
  - mesmo Merchant + mesma `Idempotency-Key` + mesmo payload → retorna a resposta original (mesmo `pay_...`), header `Idempotent-Replayed: true`;
  - mesma key + payload diferente → `409 IDEMPOTENCY_CONFLICT`;
  - requisições concorrentes com a mesma key → apenas uma cria o Payment; as demais recebem `409 IDEMPOTENCY_IN_PROGRESS` ou a resposta original.
- `customerId` de outro Merchant → `404 RESOURCE_NOT_FOUND`.

### 7.6 PIX Sandbox

- O BR Code sandbox segue a estrutura EMV, mas **não é pagável** em apps bancários reais (GUI próprio `com.nexopay.sandbox`, sem chave PIX real).
- QR Code gerado a partir do BR Code.
- `expiresAt` padrão: 1 hora (configurável por `expiresIn`, entre 5 min e 7 dias).
- `providerReference` único por cobrança.

### 7.7 Sandbox Simulator

- `POST /v1/test/payments/:id/confirm` só funciona com credenciais **sandbox**; em produção → `403 SANDBOX_ONLY`.
- Payment `PENDING` → `PAID`, cria **uma** `Transaction` e emite `payment.paid`.
- Confirmar novamente um Payment `PAID` → `200` com o Payment atual, **sem** nova Transaction, **sem** novo evento.
- Confirmações concorrentes → exatamente uma Transaction e um evento.
- Payment expirado → `409 PAYMENT_EXPIRED` (Payment passa a `EXPIRED`).
- Payment em estado terminal diferente de `PAID` → `409 INVALID_PAYMENT_STATE`.

### 7.8 Webhooks

- `POST /v1/webhook-endpoints` com `url` (https; `http` permitido apenas em desenvolvimento local) e `events` (subset de `payment.created`, `payment.paid`).
- Resposta da criação inclui o `secret` (`whsec_...`) **uma única vez**; armazenado criptografado.
- Envio **assíncrono** (nunca dentro do request que gerou o evento).
- Headers: `X-NexoPay-Event-Id`, `X-NexoPay-Timestamp`, `X-NexoPay-Signature` (HMAC-SHA256).
- O SDK fornece `verifyWebhook()` com tolerância de timestamp (anti-replay, padrão 5 min).
- 2xx = sucesso. Timeout (10 s), erro de rede ou não-2xx = falha → retry com backoff exponencial.
- URLs que resolvem para IPs privados/loopback são bloqueadas (proteção SSRF), exceto em desenvolvimento local.

### 7.9 Webhook deliveries

- Cada tentativa gera um `WebhookDelivery` com: número da tentativa, status HTTP, duração, trecho da resposta (até 2 KB), erro, próxima tentativa.
- O dashboard mostra a timeline de tentativas por evento.

### 7.10 Developer Logs

- Todo request recebe `requestId` (`req_...`), devolvido no header `X-Request-Id` e no corpo de erros.
- Registro: método, path, status, duração, API Key/usuário, `Idempotency-Key`, código de erro.
- Corpos armazenados com redaction e limite de tamanho.
- `Authorization`, cookies, secrets e senhas **nunca** são registrados.
- Exemplo de exibição: `POST /v1/payments · 201 · 183ms · req_01J...`

### 7.11 Dashboard

- Rotas: `/dashboard`, `/payments`, `/payments/[id]`, `/customers`, `/developers/api-keys`, `/developers/webhooks`, `/developers/logs`, `/settings` (+ `/login`, `/signup`).
- Indicador **SANDBOX** sempre visível em todas as telas autenticadas.
- Status de Payment sempre com **texto + ícone** (nunca apenas cor).
- Segue obrigatoriamente o Design System `nexopay-design`.

### 7.12 Checkout

- `pay.nexopay.com/p/:paymentId` exibe valor, descrição, nome do Merchant, QR Code, copia-e-cola e contagem regressiva até `expiresAt`.
- Atualiza o status automaticamente (polling) e mostra confirmação ao ser pago.
- Não expõe dados pessoais do Customer nem dados internos.
- ID inválido ou inexistente → 404.

### 7.13 SDK TypeScript

- `npm install @nexopay/sdk` · ESM + CJS · tipos completos.
- `new NexoPay({ apiKey })` detecta ambiente pelo prefixo da key.
- Recursos: `payments`, `customers`, `webhookEndpoints`, `test.payments.confirm`.
- Gera `Idempotency-Key` automaticamente em criações (sobrescrevível).
- Erros tipados com `code`, `message`, `requestId`.
- `verifyWebhook({ payload, headers, secret })`.
- Nunca expõe a API Key ao serializar/logar o client.

---

## 8. Regras financeiras

1. **Dinheiro é sempre inteiro em centavos** (`amount: 1990` = R$ 19,90). Nunca `float`, nunca `decimal` no código de domínio.
2. Moeda única no MVP: **BRL**.
3. **Payment ≠ Transaction**: Payment é a intenção de cobrança; Transaction é a movimentação efetiva (criada somente quando o Payment é pago).
4. **No máximo uma Transaction de crédito por Payment** — garantido por restrição única no banco, não apenas por código.
5. Transições de estado de Payment seguem a state machine (ver [ARCHITECTURE.md](ARCHITECTURE.md#7-payment-state-machine)); estados terminais não retrocedem.
6. **Toda operação financeira é idempotente** (criação de Payment, confirmação, futuros refunds/payouts).
7. Registros financeiros são **imutáveis**: correções são feitas por novos lançamentos, nunca por `UPDATE`/`DELETE` (princípio do Ledger futuro).
8. Tarifas no sandbox: `feeAmount = 0`. A política de tarifas é decisão de negócio pendente.
9. Formatação para exibição (`R$ 19,90`) acontece apenas na borda (UI/SDK), a partir do inteiro, sem aritmética de ponto flutuante.

---

## 9. Riscos

| Risco                                                    | Impacto | Mitigação                                                                                          |
| -------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| Duplicidade financeira por retry/concorrência            | Crítico | Idempotency-Key, update condicional de estado, constraint única em Transaction, testes de corrida. |
| Vazamento entre merchants (multi-tenancy)                | Crítico | `merchantId` obrigatório em todo repositório, 404 cross-tenant, testes dedicados.                  |
| Vazamento de API Keys / secrets                          | Crítico | Hash + pepper, exibição única, redaction de logs, criptografia de secrets de webhook.              |
| Confusão sandbox × dinheiro real                         | Alto    | Badge SANDBOX permanente, prefixo `sk_test_`, BR Code sandbox não pagável.                         |
| SSRF via URL de webhook                                  | Alto    | Bloqueio de IPs privados, sem follow de redirects, timeout.                                        |
| Webhooks perdidos (falha entre commit e fila)            | Alto    | Outbox transacional + varredura de eventos não despachados.                                        |
| Acoplamento a um PSP específico                          | Médio   | `PixProvider` como porta; domínio não conhece o provider.                                          |
| Decisões regulatórias tomadas implicitamente pelo código | Alto    | Toda decisão regulatória/financeira registrada em "Questões em aberto" e decidida pelo negócio.    |
| Escopo crescendo antes do MVP                            | Médio   | Lista explícita de fora do MVP; modular monolith; sem microservices.                               |

---

## 10. Roadmap

| Fase                       | Conteúdo                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **0 — Fundação**           | Monorepo, documentação, auth, merchant, API keys, request IDs, logging, contrato de erros.                                      |
| **1 — Sandbox Core (MVP)** | Customer, Payment, PIX sandbox, idempotência, simulator, webhooks, deliveries, dev logs, dashboard, checkout, SDK.              |
| **1.1 — Polimento**        | `payment.expired` e `payment.failed`, expiração ativa (job), reenvio manual de webhook, rotação de secret, convites de membros. |
| **2 — Pré-produção**       | Ledger double-entry, Balance derivado, rate limiting por plano, OpenTelemetry, RLS no Postgres como defesa adicional.           |
| **3 — Produção**           | Provider PIX real (após decisão de negócio), `sk_live_`, KYC/KYB, refund real, payout real.                                     |
| **Futuro**                 | Outros métodos (boleto, cartão), subscriptions, split — somente após validação do PIX em produção.                              |

---

## 11. Questões em aberto (decisões de negócio/regulatórias)

Estas questões **não bloqueiam o MVP sandbox** e **não devem ser decididas pelo código**:

1. Qual PSP/banco parceiro será usado em produção?
2. Modelo de tarifas (percentual, fixo, por plano?).
3. Requisitos de KYC/KYB para ativar o modo produção.
4. Limites por cobrança e por período (o MVP aplica apenas um limite técnico configurável).
5. CPF/CNPJ do pagador deve ser obrigatório em algum cenário?
6. Política de reembolso (prazos, MED, devolução PIX).
7. Prazo de liquidação e política de payout (D+0, D+1, retenções).
8. Retenção de dados (LGPD) para logs e dados pessoais.
9. Enquadramento regulatório da NexoPay.
