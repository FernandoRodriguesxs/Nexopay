# NexoPay Design System

Direção visual: **developer-first fintech** — financeiro, técnico, moderno, confiável, minimalista, premium.

> Para agentes: comece por [SKILL.md](SKILL.md). Este README é a visão geral para pessoas.

## Estrutura

```text
nexopay-design/
├── SKILL.md            regras obrigatórias e índice (lido por agentes)
├── README.md           este arquivo
├── styles.css          importa os tokens + base mínima
├── tokens/
│   ├── colors.css      brand, neutros, papéis semânticos, sidebar, status, sandbox, código
│   ├── typography.css  Geist / Geist Mono, escala, pesos, tracking
│   ├── spacing.css     escala de 4 px, radius por hierarquia, sombras, medidas de layout
│   └── motion.css      durações e curvas; reduced motion
└── guidelines/
    ├── dashboard.md    layout, navegação, faixa de métricas, tabelas, timeline, estados
    ├── payments.md     PaymentStatus, Money, PaymentRow, TransactionRow, detalhe do payment
    ├── checkout.md     página hospedada de pagamento PIX
    └── developer.md    API Keys, webhooks, deliveries, logs, CodeBlock, CopyButton, ambiente
```

## Como os tokens chegam ao produto

```text
.claude/skills/nexopay-design/tokens/*.css   (variáveis --np-*)
        │  @import
        ▼
.claude/skills/nexopay-design/styles.css
        │  @import (depois de tailwindcss)
        ▼
packages/ui/src/styles/globals.css           (@theme inline: --np-* → classes Tailwind)
        │  @import '@nexopay/ui/styles.css'
        ▼
apps/dashboard · apps/checkout · apps/docs
```

Existe **uma** fonte de verdade. Alterar `tokens/colors.css` altera todos os apps.

## Paleta essencial

| Token                   | Hex       | Uso                                          |
| ----------------------- | --------- | -------------------------------------------- |
| `--np-color-brand`      | `#16DB7D` | Botão primário, indicador ativo, estado pago |
| `--np-color-brand-ink`  | `#0A7D47` | Texto/links verdes e foco sobre fundo claro  |
| `--np-color-sidebar`    | `#0F1113` | Navegação, CodeBlock                         |
| `--np-color-background` | `#F6F7F8` | Workspace                                    |
| `--np-color-surface`    | `#FFFFFF` | Painéis e tabelas                            |
| `--np-color-border`     | `#E3E6E9` | Bordas de superfície                         |
| `--np-color-sandbox`    | `#F97316` | Faixa e badge de ambiente SANDBOX            |

## Status de Payment

| Status     | Label       | Ícone Lucide  | Tom      |
| ---------- | ----------- | ------------- | -------- |
| `PENDING`  | Pendente    | `Clock`       | Âmbar    |
| `PAID`     | Pago        | `CircleCheck` | Verde    |
| `FAILED`   | Falhou      | `CircleX`     | Vermelho |
| `EXPIRED`  | Expirado    | `TimerOff`    | Cinza    |
| `REFUNDED` | Reembolsado | `Undo2`       | Azul     |
