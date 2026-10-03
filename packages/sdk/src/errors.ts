export class NexoPayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NexoPayError';
  }
}

export class NexoPayConfigurationError extends NexoPayError {
  constructor(message: string) {
    super(message);
    this.name = 'NexoPayConfigurationError';
  }
}
