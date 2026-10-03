export interface RateLimitRule {
  /** Nome da regra, parte da chave (ex.: `login:ip`). */
  readonly name: string;
  readonly limit: number;
  readonly windowSeconds: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

/**
 * Porta de rate limiting (janela fixa). Implementações: Redis (runtime) e
 * memória (testes). Classe abstrata para servir de token de DI.
 */
export abstract class RateLimiter {
  /** Consome uma unidade de `rule` para `subject`. `subject` nunca deve conter PII em claro. */
  abstract consume(rule: RateLimitRule, subject: string, now: Date): Promise<RateLimitResult>;
}

export function windowBounds(rule: RateLimitRule, now: Date): { index: number; endsAt: number } {
  const windowMs = rule.windowSeconds * 1000;
  const index = Math.floor(now.getTime() / windowMs);
  return { index, endsAt: (index + 1) * windowMs };
}

export function retryAfterSeconds(endsAt: number, now: Date): number {
  return Math.max(1, Math.ceil((endsAt - now.getTime()) / 1000));
}
