import { NexoPayConfigurationError } from './errors.js';

export type NexoPayEnvironment = 'sandbox' | 'production';

export interface NexoPayOptions {
  /** Secret key (`sk_test_...` em sandbox, `sk_live_...` em produção). */
  readonly apiKey: string;
  /** Sobrescreve a URL da API (útil para desenvolvimento local). */
  readonly baseUrl?: string;
  /** Implementação de fetch customizada (padrão: `globalThis.fetch`). */
  readonly fetch?: typeof fetch;
}

const DEFAULT_BASE_URL = 'https://api.nexopay.com';

const KEY_ENVIRONMENTS: Readonly<Record<string, NexoPayEnvironment>> = {
  sk_test_: 'sandbox',
  sk_live_: 'production',
};

function resolveEnvironment(apiKey: string): NexoPayEnvironment {
  const prefix = Object.keys(KEY_ENVIRONMENTS).find((candidate) => apiKey.startsWith(candidate));
  const environment = prefix ? KEY_ENVIRONMENTS[prefix] : undefined;
  if (!environment) {
    throw new NexoPayConfigurationError(
      'Invalid API key: expected a key starting with sk_test_ or sk_live_.',
    );
  }

  return environment;
}

export class NexoPay {
  readonly environment: NexoPayEnvironment;
  readonly baseUrl: string;

  readonly #apiKey: string;
  readonly #fetch: typeof fetch;

  constructor(options: NexoPayOptions) {
    this.environment = resolveEnvironment(options.apiKey);
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.#apiKey = options.apiKey;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** Evita que a chave apareça ao serializar/logar o client. */
  toJSON(): Record<string, string> {
    return { environment: this.environment, baseUrl: this.baseUrl };
  }

  /** @internal Usado pelos recursos (payments, customers...) nas próximas etapas. */
  protected get credentials(): { readonly apiKey: string; readonly fetch: typeof fetch } {
    return { apiKey: this.#apiKey, fetch: this.#fetch };
  }
}
