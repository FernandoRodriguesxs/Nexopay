# Payments

Componentes que representam dinheiro e estado. São os mais importantes do produto: precisam ser
inequívocos.

## PaymentStatus

| Status     | Label       | Ícone Lucide  | Tokens                           |
| ---------- | ----------- | ------------- | -------------------------------- |
| `PENDING`  | Pendente    | `Clock`       | `status-pending-{fg,bg,border}`  |
| `PAID`     | Pago        | `CircleCheck` | `status-paid-{fg,bg,border}`     |
| `FAILED`   | Falhou      | `CircleX`     | `status-failed-{fg,bg,border}`   |
| `EXPIRED`  | Expirado    | `TimerOff`    | `status-expired-{fg,bg,border}`  |
| `REFUNDED` | Reembolsado | `Undo2`       | `status-refunded-{fg,bg,border}` |

- Forma: ícone 14 px + label 13 px medium, padding `2px 8px`, borda 1 px, `rounded-sm` (4 px — não é pill).
- **Sempre ícone + texto.** Nunca só um ponto colorido. Nunca só a cor.
- O mapeamento status → label/ícone/tokens vive **num único objeto** em `packages/ui` (`PAYMENT_STATUS_PRESENTATION`), tipado por `PaymentStatus` de `@nexopay/contracts`, com checagem exaustiva.
- Variante `size="lg"` no detalhe do payment (ícone 16, texto 14).
- Acessibilidade: o texto visível já é o nome acessível; ícone com `aria-hidden`.

```tsx
<PaymentStatus status="PAID" />        // [✓ Pago]
<PaymentStatus status="PENDING" />     // [◷ Pendente]
```

## Money

Entrada: **inteiro em centavos** (`amount: number`) + `currency: 'BRL'`. Saída: `R$ 1.990,00`.

- **Sem aritmética de ponto flutuante**: separar reais e centavos com divisão inteira e resto
  (`Math.trunc(abs / 100)`, `abs % 100`), formatar a parte inteira com `Intl.NumberFormat('pt-BR')`
  e compor `R$ {reais},{centavos com 2 dígitos}`. Rejeitar (lançar erro em dev) valores não inteiros.
- Sempre `font-variant-numeric: tabular-nums`.
- Negativos: sinal de menos tipográfico `−R$ 19,90` (U+2212), nunca apenas vermelho.
- Variantes:

| Variante  | Uso                                    | Estilo                                                                                                               |
| --------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `inline`  | Tabelas, textos                        | Tamanho herdado, regular/medium                                                                                      |
| `display` | Detalhe do payment, métricas, checkout | `text-2xl`/`text-3xl` semibold, tracking tight, **centavos atenuados** (`,00` em `text-ink-secondary` e 0,6em menor) |

```text
display:   R$ 1.990,00   →   "R$ 1.990" em ink-950  +  ",00" menor em gray-600
inline:    R$ 1.990,00
```

- `aria-label` com o valor completo por extenso numérico ("R$ 1.990,00") quando a variante display separar visualmente os centavos.

## PaymentRow

Linha da tabela de pagamentos (`/payments` e pagamentos recentes).

| Coluna    | Conteúdo                                             | Alinhamento |
| --------- | ---------------------------------------------------- | ----------- |
| Valor     | `Money inline` medium                                | Direita     |
| Status    | `PaymentStatus`                                      | Esquerda    |
| Descrição | Texto, truncado em 1 linha; vazio = `—`              | Esquerda    |
| Cliente   | Nome (ou email) em `text-ink-secondary`; vazio = `—` | Esquerda    |
| ID        | `pay_…` mono 13 px + `CopyButton` no hover/foco      | Esquerda    |
| Criado em | `03 out, 14:32` tabular `text-ink-secondary`         | Direita     |

- A linha inteira navega para `/payments/[id]`.
- Valor primeiro: é o que o merchant procura.

## TransactionRow

Representa movimentação efetiva (não confundir com Payment).

| Coluna    | Conteúdo                                                                                   | Alinhamento |
| --------- | ------------------------------------------------------------------------------------------ | ----------- |
| Tipo      | Ícone + texto: `ArrowDownLeft` "Recebimento" · `ArrowUpRight` "Reembolso"/"Saque" (futuro) | Esquerda    |
| Bruto     | `Money inline`                                                                             | Direita     |
| Tarifa    | `Money inline` em `text-ink-secondary` (sandbox: R$ 0,00)                                  | Direita     |
| Líquido   | `Money inline` medium                                                                      | Direita     |
| Pagamento | `pay_…` mono, link                                                                         | Esquerda    |
| ID        | `txn_…` mono + `CopyButton`                                                                | Esquerda    |
| Data      | tabular                                                                                    | Direita     |

- Créditos e débitos diferenciados por **ícone + texto + sinal** (`−` em débitos); cor só reforça.

## Detalhe do payment (`/payments/[id]`)

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ Pagamentos / pay_01J9Z…X4QZ  ⧉                                            │
│                                                                           │
│ R$ 1.990,00                                   [Simular pagamento]          │  ← display + ação sandbox (só PENDING)
│ [✓ Pago]   Pedido #1042                                                   │
├──────────────────────────────────────┬────────────────────────────────────┤
│ Timeline                             │ Detalhes                           │
│  ● Pago          14:32:10            │  Método        PIX                 │
│  ● Webhook enviado 14:32:11          │  Criado em     03 out 2026, 14:20  │
│  ○ Criado        14:20:02            │  Expira em     03 out 2026, 15:20  │
│                                      │  Cliente       Maria Souza         │
│                                      │  Referência    sbx_7f3…  ⧉         │
├──────────────────────────────────────┴────────────────────────────────────┤
│ Eventos de webhook (WebhookEvent → WebhookDelivery)                       │
│ Metadata (CodeBlock JSON)                                                 │
└───────────────────────────────────────────────────────────────────────────┘
```

- "Simular pagamento" aparece quando a API informa `status = PENDING` e ambiente sandbox; a decisão real é do backend.
- Dados PIX: BR Code em mono com `CopyButton`, QR Code em tamanho reduzido.
- Lista de detalhes como pares rótulo/valor (rótulo 13 px `text-ink-secondary`, valor 14 px); IDs em mono.
