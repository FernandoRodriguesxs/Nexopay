# Developer

Superfícies usadas por quem integra: chaves, webhooks, logs, código. Devem passar a precisão de
uma ferramenta de terminal sem perder legibilidade.

## EnvironmentBadge

- Ícone `FlaskConical` 14 px + texto `SANDBOX` em mono 12 px medium (única label em caixa alta, por ser um identificador de ambiente).
- Tokens `sandbox-{fg,bg,border}`, `rounded-sm`, padding `2px 8px`.
- Sempre na topbar do dashboard; acompanhado da faixa `bg-sandbox` de 2 px no topo do workspace.
- Futuro: variante `PRODUCTION` neutra (sem laranja) — o destaque é para o ambiente de teste.

## CopyButton

- Botão ícone (`Copy` 14 px) com `aria-label="Copiar <o quê>"` específico ("Copiar ID do pagamento").
- Ao copiar: ícone troca para `Check` em `status-paid-fg` por 2 s (`--np-duration-fast`), tooltip "Copiado".
- Tamanho mínimo de alvo 28×28 px; visível no hover **e** no foco da linha.
- Falha na Clipboard API: tooltip "Não foi possível copiar" e seleciona o texto.

## CodeBlock

- Fundo `code-bg` (#0F1113, coerente com a sidebar), borda `code-border`, `rounded-lg`, padding 16 px.
- Geist Mono 13 px, line-height 1.6. Sintaxe com os tokens `code-*` (string verde-menta, keyword azul, número âmbar). Nada de temas de editor aleatórios.
- Cabeçalho opcional: abas de linguagem (`TypeScript`, `cURL`) à esquerda, `CopyButton` à direita.
- Rolagem horizontal, sem quebrar linhas de código. Números de linha só em blocos > 10 linhas.
- Código inline: `code-inline-bg`, `rounded-sm`, padding `1px 4px`, 0,92em.
- Secrets em exemplos usam placeholders (`sk_test_...`), nunca chaves reais.

## ApiKeyCard

Exibido **uma única vez**, logo após criar a chave.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Chave criada: Backend produção                                       │
│ Copie agora. Por segurança, ela não será exibida novamente.          │
│                                                                      │
│ ┌──────────────────────────────────────────────────────┐            │
│ │ sk_test_exemplo_nao_e_chave_real                     │  [Copiar]  │  mono 14 px, fundo surface-sunken
│ └──────────────────────────────────────────────────────┘            │
│                                                                      │
│ [Concluir]                                                           │
└──────────────────────────────────────────────────────────────────────┘
```

- Dentro de um dialog; "Concluir" só fecha. Fechar sem copiar pede confirmação.
- Na **lista** de chaves (tabela): nome, dica `sk_test_…a1b2` em mono, criada em, último uso ("há 3 min" / "Nunca usada"), status (Ativa / Revogada com `Ban`), ação "Revogar".
- Revogar: dialog de confirmação com o nome da chave e consequência explícita ("Requests usando essa chave passarão a falhar imediatamente."). Botão `danger` "Revogar chave". Toast "Chave revogada".

## WebhookEvent

Linha/painel de um evento.

| Elemento  | Padrão                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Tipo      | `payment.paid` em mono 13 px (é um identificador de máquina)                                                                   |
| Recurso   | `pay_…` mono, link para o payment                                                                                              |
| Resultado | Resumo textual: "Entregue" (`CircleCheck`), "Tentando novamente" (`RotateCw`), "Falhou" (`CircleX`), "Sem endpoints" (`Minus`) |
| Data      | tabular, `text-ink-secondary`                                                                                                  |
| Expandido | Payload em `CodeBlock` JSON + lista de `WebhookDelivery`                                                                       |

## WebhookDelivery

Uma tentativa de entrega. Exibida como Timeline dentro do evento.

```text
  ● Tentativa 3 · 200 OK · 183 ms                     03 out, 14:40:12
  ● Tentativa 2 · 500 Internal Server Error · 2,1 s   03 out, 14:35:11
  ● Tentativa 1 · Timeout após 10 s                   03 out, 14:34:01
```

- HTTP status em mono com cor por classe (`http-2xx/4xx/5xx`) **e** o texto do status; timeout/erro de rede escritos por extenso.
- Duração tabular (`183 ms`, `2,1 s`).
- Expandir mostra corpo da resposta (truncado, 2 KB) em CodeBlock e os headers enviados (sem o secret, com a assinatura visível).
- Próxima tentativa: "Próxima tentativa em 4 min" (tabular, atualizada).

## Developer Logs

Tabela de requests, densa e escaneável:

| Coluna  | Conteúdo                                                                       |
| ------- | ------------------------------------------------------------------------------ |
| Método  | `POST` mono 12 px medium, `text-ink-secondary`                                 |
| Path    | `/v1/payments` mono 13 px                                                      |
| Status  | `201` mono com cor por classe + ícone para 4xx/5xx (`TriangleAlert`/`CircleX`) |
| Duração | `183 ms` tabular, à direita                                                    |
| Request | `req_01J9…` mono + `CopyButton`                                                |
| Data    | tabular                                                                        |

- Filtros: status (2xx/4xx/5xx), método, path, chave de API.
- Detalhe (sheet lateral): request e response em CodeBlock (já redigidos pela API), `Idempotency-Key`, código de erro.
- `Authorization` nunca aparece — nem mascarado.

## Webhook endpoints

- Tabela: URL (mono, truncada no meio), eventos inscritos (texto: "payment.created, payment.paid" — sem pill por evento), status (Ativo/Desativado com ícone), taxa de sucesso 24 h (texto + número).
- Criação: dialog com URL + checkboxes de eventos; ao criar, exibir o `whsec_...` uma vez (mesmo padrão do ApiKeyCard) + snippet de verificação com `verifyWebhook()` do SDK.
