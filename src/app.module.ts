import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { GameModule } from './game/game.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/poker'),
    GameModule,
    TelegramModule,
  ],
})
export class AppModule {}
