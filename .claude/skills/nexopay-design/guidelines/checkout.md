# Checkout

Página hospedada `pay.nexopay.com/p/:paymentId`, vista pelo **pagador** (não pelo desenvolvedor).
Objetivo único: pagar o PIX com confiança. Sem navegação, sem distrações.

## Layout

```text
                 ┌───────────────────────────────────┐
                 │ Acme Ltda                          │  nome do merchant (16 px medium)
                 │                                    │
                 │ R$ 1.990,00                        │  Money display (36 px), centavos atenuados
                 │ Pedido #1042                       │  descrição (ink-secondary)
                 │                                    │
                 │        ┌──────────────┐            │
                 │        │   QR CODE    │            │  ~220 px, fundo branco, quiet zone
                 │        └──────────────┘            │
                 │                                    │
                 │ [ 00020126...6304ABCD    Copiar ]  │  copia-e-cola (mono) + CopyButton
                 │                                    │
                 │ ◷ Aguardando pagamento · expira em 58:12 │
                 └───────────────────────────────────┘
                   Pagamento processado por NexoPay       (12 px, ink-tertiary)
```

- Fundo `background` (#F6F7F8); cartão central branco, `rounded-xl` (14 px), borda `border`, largura máx. 420 px.
- Conteúdo **alinhado à esquerda** dentro do cartão; o QR Code é o único elemento centralizado.
- Mobile first: funciona a partir de 360 px; em telas pequenas o cartão ocupa a largura com 16 px de margem.
- Corpo 16 px (`text-md`).

## Estados

| Estado         | Apresentação                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------- |
| Pendente       | QR + copia-e-cola + "Aguardando pagamento" com ícone `Clock` e contagem regressiva tabular.  |
| Pago           | QR substituído por `CircleCheck` 40 px em `status-paid-fg` + "Pagamento confirmado" + valor. |
| Expirado       | `TimerOff` + "Este PIX expirou. Peça um novo link a quem fez a cobrança."                    |
| Falhou         | `CircleX` + mensagem direta, sem detalhes técnicos.                                          |
| Não encontrado | 404 simples: "Pagamento não encontrado. Confira o link recebido."                            |

- **Momento orquestrado único:** a transição Pendente → Pago usa `--np-duration-slow` (fade do QR + escala sutil do ícone de 0,96 → 1). É a única animação não disparada pelo usuário em todo o produto. Com reduced motion, troca instantânea.
- O status é anunciado para leitores de tela (`aria-live="polite"`).
- Polling a cada 3 s enquanto pendente; para em estados terminais.

## Sandbox

- Faixa superior de 2 px `bg-sandbox` + aviso no cartão: `EnvironmentBadge` e o texto
  "Ambiente de teste. Este PIX não pode ser pago em um banco real."
- Opcionalmente, botão secundário "Simular pagamento" (somente sandbox, decidido pela API).

## Cópia e confiança

- Sem jargão técnico: o pagador não vê `pay_...`, `providerReference` nem códigos de erro.
- Nunca exibir dados pessoais do Customer.
- Botão "Copiar" muda para "Copiado" com `Check` por 2 s.
- Instrução curta abaixo do código: "Abra o app do seu banco, escolha Pix copia e cola e cole o código."
