import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TelegramModule } from 'nestjs-telegram';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Game, GameSchema } from './schemas/game.schema';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/poker'),
    MongooseModule.forFeature([{ name: Game.name, schema: GameSchema }]),
    TelegramModule.forRoot({
      botKey: '5496911846:AAEwqUsPevvgOAeeoMX61nUoFgHKsEvauME',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
