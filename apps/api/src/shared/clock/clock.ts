import { Injectable } from '@nestjs/common';

/** Fonte única de "agora". Use cases recebem o tempo daqui; o domínio recebe `now` por parâmetro. */
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}
