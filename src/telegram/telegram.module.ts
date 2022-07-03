import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { TelegramModule as TelegramModuleNest } from 'nestjs-telegram';

import { GameModule } from '../game/game.module';
import { Game, GameSchema } from '../game/schemas/game.schema';
import { TelegramService } from './telegram.service';

@Module({
  imports: [
    TelegramModuleNest.forRoot({
      botKey: '5496911846:AAEwqUsPevvgOAeeoMX61nUoFgHKsEvauME',
    }),
    ScheduleModule.forRoot(),
    GameModule,
    MongooseModule.forFeature([{ name: Game.name, schema: GameSchema }]),
  ],
  providers: [TelegramService],
})
export class TelegramModule {}
