import { Body, Controller, Get, Post } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateGameDto } from './dto/create-game.dto';
import { Game, GameDocument } from './schemas/game.schema';

@Controller()
export class AppController {
  constructor(@InjectModel(Game.name) private gameModel: Model<GameDocument>) {}

  @Get()
  games(): Promise<Game[]> {
    return this.gameModel.find().exec();
  }

  @Post()
  createGame(@Body() createGameDto: CreateGameDto): Promise<Game> {
    const createdGame = new this.gameModel(createGameDto);
    return createdGame.save();
  }
}
