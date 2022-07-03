import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TelegramModule as TelegramModuleNest } from 'nestjs-telegram';

import { GameModule } from '../game/game.module';
import { TelegramService } from './telegram.service';

@Module({
  imports: [
    TelegramModuleNest.forRoot({
      botKey: '5496911846:AAEwqUsPevvgOAeeoMX61nUoFgHKsEvauME',
    }),
    ScheduleModule.forRoot(),
    GameModule,
  ],
  providers: [TelegramService],
})
export class TelegramModule {}
