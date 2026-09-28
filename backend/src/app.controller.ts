import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth() {
    return {
      success: true,
      data: this.appService.getHealth(),
      error: null,
      timestamp: new Date().toISOString(),
    };
  }
}
