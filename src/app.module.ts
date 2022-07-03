import { Module } from '@nestjs/common';

import { GameModule } from './game/game.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [GameModule, TelegramModule],
})
export class AppModule {}
