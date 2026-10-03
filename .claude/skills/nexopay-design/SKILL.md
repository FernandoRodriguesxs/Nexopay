---
name: nexopay-design
description: Design System da NexoPay (developer-first fintech). Use SEMPRE que criar ou alterar qualquer UI do monorepo — apps/dashboard, apps/checkout, apps/docs ou packages/ui — incluindo telas, componentes, estados de Payment, valores monetários, badges de ambiente, tabelas, logs, webhooks, blocos de código e cópia de interface.
---

# NexoPay Design System

A NexoPay deve parecer uma **ferramenta de infraestrutura financeira**: precisa, técnica, calma e
confiável. Não um banco tradicional, não um template de SaaS.

## Quando usar

Antes de escrever qualquer JSX/CSS de produto. Leia este arquivo e o guideline da área:

| Área                                                        | Guideline                                          |
| ----------------------------------------------------------- | -------------------------------------------------- |
| Layout do dashboard, navegação, métricas, tabelas, timeline | [guidelines/dashboard.md](guidelines/dashboard.md) |
| Status, valores, PaymentRow, TransactionRow                 | [guidelines/payments.md](guidelines/payments.md)   |
| Checkout hospedado                                          | [guidelines/checkout.md](guidelines/checkout.md)   |
| API Keys, webhooks, logs, código, ambiente                  | [guidelines/developer.md](guidelines/developer.md) |

## Fonte de verdade

- Tokens: [tokens/](tokens/) (`colors`, `typography`, `spacing`, `motion`) — variáveis `--np-*`.
- [styles.css](styles.css) importa os tokens + base mínima.
- `packages/ui/src/styles/globals.css` importa `styles.css` e mapeia os tokens para o Tailwind v4
  (`bg-brand`, `text-ink-secondary`, `rounded-lg`, `bg-status-paid-bg`...). **Editar um token muda o produto.**
- Nunca escreva hex soltos em componentes. Se faltar um token, crie-o aqui primeiro.

## Identidade em uma frase

**Navegação escura, workspace claro, verde usado com parcimônia, números tratados como instrumento.**

| Elemento   | Valor                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Brand      | `#16DB7D` — preenchimento (botão primário, indicador ativo, estado pago). Texto verde em fundo claro usa `brand-ink #0A7D47`. |
| Background | `#F6F7F8` (workspace)                                                                                                         |
| Sidebar    | `#0F1113`                                                                                                                     |
| Superfície | `#FFFFFF` com borda `#E3E6E9`                                                                                                 |
| Fontes     | **Geist** (UI) · **Geist Mono** (código e valores de máquina)                                                                 |
| Ícones     | **Lucide** — única biblioteca. Stroke 1.75, tamanhos 14/16/20.                                                                |

### O elemento memorável: dinheiro como instrumento

Valores monetários são o centro visual do produto. Sempre com algarismos tabulares, alinhados à
direita em colunas, com os centavos atenuados em valores de destaque (`R$ 1.990`**`,00`** com
`,00` em `text-ink-secondary`). Métricas são agrupadas numa **faixa única com divisores verticais**,
não em cards soltos. Todo o resto fica quieto para que os números falem.

## Regras obrigatórias

1. **Status nunca só por cor**: sempre ícone + texto (`PaymentStatus`).
2. **SANDBOX sempre visível** no dashboard: faixa laranja de 2 px no topo do workspace + `EnvironmentBadge` na topbar.
3. **Dinheiro**: recebido em centavos inteiros; formatado só na borda pelo componente `Money`, sem aritmética de ponto flutuante.
4. **Mono só para valores de máquina**: IDs (`pay_...`), keys, paths HTTP, payloads, códigos de erro, `requestId`. Nunca para labels ou títulos.
5. **Sentence case** em tudo. Sem labels em CAIXA ALTA (exceções: `SANDBOX`, métodos HTTP `GET/POST`, status `PENDING` em payloads de código).
6. **Superfícies se separam por borda**, não por sombra. Sombra apenas em overlays (popover, dialog, toast).
7. **Radius por hierarquia**: `sm 4px` badges · `md 6px` controles · `lg 10px` superfícies · `xl 14px` overlays.
8. **Listas são tabelas**, não grades de cards. Cards só quando o conteúdo não é tabular (ex.: ApiKeyCard recém-criada).
9. **Movimento só em resposta a ação** (abrir, expandir, copiar, confirmar). Respeite `prefers-reduced-motion`.
10. **Foco visível** em tudo que é interativo (anel `focus` 2 px; `sidebar-focus` na navegação escura).

## Evitar

Glassmorphism · gradientes decorativos · glow · sombras pesadas · animações de entrada em cada seção ·
emojis como ícones · excesso de pills/badges · ilustrações genéricas · ícones de outras bibliotecas ·
`→` em textos de botão · cards idênticos lado a lado com a mesma sombra · cinza-azulado de template ·
verde de marca como cor de texto em fundo claro.

## Escrita de interface (pt-BR)

- Verbos diretos e específicos: "Criar chave", "Revogar chave", "Simular pagamento". A mesma ação mantém o mesmo nome no botão, no dialog e no toast ("Chave revogada").
- Nomeie pelo que o usuário entende: "Pagamentos", "Clientes", "Chaves de API", "Webhooks", "Logs".
- Erros dizem o que aconteceu e como resolver; não pedem desculpas. Ex.: "Essa chave foi revogada. Crie uma nova em Chaves de API."
- Estado vazio convida à ação: "Nenhum pagamento ainda. Crie o primeiro com o SDK ou pelo botão abaixo." + snippet.
- Datas: `03 out 2026, 14:32`; relativas só para < 24 h ("há 5 min").

## Componentes financeiros (padrões)

| Componente         | Guideline                        |
| ------------------ | -------------------------------- |
| `PaymentStatus`    | payments.md                      |
| `PaymentRow`       | payments.md                      |
| `TransactionRow`   | payments.md                      |
| `Money`            | payments.md                      |
| `MetricCard`       | dashboard.md (faixa de métricas) |
| `Timeline`         | dashboard.md                     |
| `ApiKeyCard`       | developer.md                     |
| `WebhookEvent`     | developer.md                     |
| `WebhookDelivery`  | developer.md                     |
| `CodeBlock`        | developer.md                     |
| `CopyButton`       | developer.md                     |
| `EnvironmentBadge` | developer.md                     |

Implementações vivem em `packages/ui/src/components/` (kebab-case: `payment-status.tsx`).

## Checklist antes de concluir uma UI

- [ ] Só tokens (`--np-*` / classes mapeadas), nenhum hex solto.
- [ ] Status com ícone + texto; SANDBOX visível.
- [ ] Valores via `Money`, tabulares, alinhados à direita em tabelas.
- [ ] Mono apenas para valores de máquina.
- [ ] Estados vazio, carregando (skeleton com as dimensões finais) e erro desenhados.
- [ ] Navegável por teclado, foco visível, contraste AA.
- [ ] Funciona em 1280 px e degrada bem até 768 px (checkout: até 360 px).
- [ ] Nenhuma regra de negócio no componente.
