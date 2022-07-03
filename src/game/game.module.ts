import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { GameService } from './game.service';
import { Game, GameSchema } from './schemas/game.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Game.name, schema: GameSchema }]),
  ],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
