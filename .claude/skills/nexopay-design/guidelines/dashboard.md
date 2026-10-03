# Dashboard

O dashboard é onde o merchant **opera e depura** pagamentos. Densidade moderada, leitura rápida,
nada decorativo.

## Anatomia

```text
┌──────────────┬──────────────────────────────────────────────────────────────┐
│              │▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ faixa SANDBOX 2px (laranja) ▔▔▔▔▔▔▔▔▔▔▔▔▔│
│  NexoPay     │  Pagamentos                         [⚗ SANDBOX]  [Buscar ⌘K] │ topbar 56px (branca)
│  Acme Ltda ▾ ├──────────────────────────────────────────────────────────────┤
│              │                                                              │
│  Visão geral │  Título da página                         [Ação primária]    │
│  Pagamentos ▌│  Descrição curta em ink-secondary                           │
│  Clientes    │                                                              │
│              │  ┌────────────────────────────────────────────────────────┐  │
│  Developers  │  │  superfície (borda, radius lg)                         │  │
│   Chaves     │  │                                                        │  │
│   Webhooks   │  └────────────────────────────────────────────────────────┘  │
│   Logs       │                                                              │
│              │                 workspace #F6F7F8 · max 1200px · padding 32  │
│  Config.     │                                                              │
│  ──────────  │                                                              │
│  usuário     │                                                              │
└──────────────┴──────────────────────────────────────────────────────────────┘
   240px #0F1113
```

- **Alinhamento:** tudo alinhado à esquerda; números alinhados à direita dentro de colunas.
- **Sidebar** (`bg-sidebar`): logotipo, seletor de merchant, navegação, usuário no rodapé.
  - Item: 32 px de altura, ícone Lucide 16 px + label 14 px `sidebar-text-muted`.
  - Hover: `bg-sidebar-hover`. Ativo: texto `sidebar-text` + **barra vertical de 2 px `sidebar-active`** à esquerda. Não pinte o item inteiro de verde.
  - Grupo "Developers" com sub-itens indentados (Chaves de API, Webhooks, Logs). Rótulos de grupo em sentence case, 12 px, `sidebar-text-muted`.
- **Topbar** (branca, borda inferior `border`): título da página atual (breadcrumb em detalhes), `EnvironmentBadge`, busca.
- **Faixa de ambiente:** `--np-env-stripe-height` (2 px) em `bg-sandbox` no topo do workspace, sempre que o ambiente for SANDBOX.

## Rotas e conteúdo

| Rota                   | Conteúdo principal                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `/dashboard`           | Faixa de métricas · pagamentos recentes · onboarding (checklist até o 1º pagamento) |
| `/payments`            | Tabela de pagamentos com filtros (status, período, busca por `pay_`/cliente)        |
| `/payments/[id]`       | Valor em destaque, status, Timeline, dados PIX, cliente, eventos de webhook         |
| `/customers`           | Tabela de clientes                                                                  |
| `/developers/api-keys` | Lista de chaves + criar/revogar (ApiKeyCard ao criar)                               |
| `/developers/webhooks` | Endpoints, eventos e tentativas de entrega                                          |
| `/developers/logs`     | Developer Logs (requests da API)                                                    |
| `/settings`            | Dados do merchant, membros, conta                                                   |

## Cabeçalho de página

- Título `text-xl` (22 px) `semibold`, tracking tight. Descrição opcional em `text-ink-secondary`, uma linha.
- Ação primária à direita (botão `brand`). No máximo **uma** ação primária por página.
- Sem eyebrow/rótulo acima do título.

## MetricCard → faixa de métricas

Métricas não são cards soltos: ficam **numa única superfície**, divididas por linhas verticais.

```text
┌──────────────────────┬──────────────────────┬──────────────────────┬─────────────────┐
│ Recebido hoje        │ Pagamentos pagos     │ Pendentes            │ Taxa de conversão│
│ R$ 12.480,00         │ 37                   │ 4                    │ 90,2%            │
│ +R$ 1.990,00 vs ontem│ de 41 criados        │ R$ 396,00 em aberto  │ últimos 7 dias   │
└──────────────────────┴──────────────────────┴──────────────────────┴─────────────────┘
```

- Label 13 px `text-ink-secondary` · valor `text-2xl` semibold tabular (via `Money` quando monetário) · contexto 12 px `text-ink-tertiary`.
- Variação: texto explícito ("+R$ 1.990,00 vs ontem"), com sinal; cor (`status-paid-fg`/`status-failed-fg`) apenas como reforço.
- Sem sparklines decorativos no MVP; sem ícones grandes em círculos coloridos.
- Prop sugerida: `{ label, value: ReactNode, context?: string }`; o container `MetricStrip` cuida dos divisores e quebra em 2 colunas abaixo de 1024 px.

## Tabelas

- Superfície branca, borda `border`, `rounded-lg`, sem sombra (ou `shadow-surface`).
- Cabeçalho: 12 px `text-ink-secondary` medium, fundo `surface-sunken`, sentence case.
- Linha: `--np-row-height` (44 px), divisor `divider`, hover `surface-sunken`. Linha inteira clicável quando leva a um detalhe (com `<a>` real para acessibilidade).
- Colunas numéricas e monetárias alinhadas à direita, tabulares.
- IDs em mono 13 px `text-ink-secondary`, truncados no meio se necessário (`pay_01J9…X4QZ`) com `CopyButton` no hover/foco.
- Paginação por cursor: "Anterior" / "Próxima" + contagem exibida ("1–20").
- Carregando: skeleton das linhas com as dimensões reais. Erro: mensagem na própria superfície com "Tentar novamente".

## Timeline

Usada no detalhe do payment (ciclo de vida) e nos webhooks (tentativas).

```text
  ● Pago                                   03 out 2026, 14:32:10
  │ Confirmado pelo simulador sandbox
  │
  ● Evento payment.paid enviado            03 out 2026, 14:32:11
  │ 1 endpoint · 200 em 183 ms
  │
  ○ Criado                                 03 out 2026, 14:20:02
    R$ 19,90 · expira em 1 h
```

- Vertical, mais recente no topo. Marcador 8 px: preenchido (`status-*-fg` do evento) para fatos concluídos, vazado para o início.
- Título 14 px medium + data à direita em 12 px tabular; detalhe em 13 px `text-ink-secondary`.
- Cada item comunica por texto; a cor do marcador é reforço.

## Estados

| Estado     | Padrão                                                                             |
| ---------- | ---------------------------------------------------------------------------------- |
| Vazio      | Frase direta + próxima ação + snippet de código quando a ação é via API.           |
| Carregando | Skeleton com o formato final (sem spinners de página inteira).                     |
| Erro       | O que falhou + ação ("Tentar novamente") + `requestId` em mono quando vier da API. |
| Sucesso    | Toast curto com o mesmo verbo da ação ("Chave revogada").                          |

## Onboarding (visão geral)

Checklist até o primeiro pagamento sandbox (é uma sequência real, então números são apropriados):

1. Criar chave de API
2. Instalar o SDK (`npm install @nexopay/sdk`)
3. Criar um pagamento
4. Simular o pagamento
5. Receber o webhook `payment.paid`

Cada passo marca concluído automaticamente a partir de dados da API. Some quando os 5 estiverem completos.
