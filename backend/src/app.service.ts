import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'Kingdom of Chess API',
      timestamp: new Date().toISOString(),
    };
  }
}
