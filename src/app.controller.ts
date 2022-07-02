import { Body, Controller, Get, NotFoundException, Post } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ConnectGameDto } from './dto/connect-game.dto';
import { CreateGameDto } from './dto/create-game.dto';
import { Game, GameDocument } from './schemas/game.schema';

@Controller()
export class AppController {
  constructor(@InjectModel(Game.name) private gameModel: Model<GameDocument>) {}

  @Get()
  games(): Promise<Game[]> {
    return this.gameModel.find({ opened: true }).exec();
  }

  @Post('create')
  createGame(@Body() createGameDto: CreateGameDto): Promise<Game> {
    const createdGame = new this.gameModel(createGameDto);
    return createdGame.save();
  }

  @Post('connect')
  async connectGame(@Body() connectGameDto: ConnectGameDto) {
    const game = await this.gameModel.findOneAndUpdate(
      {
        _id: connectGameDto.id,
        opened: true,
      },
      { opened: false },
    );
    if (game === null)
      throw new NotFoundException(`Game #${connectGameDto.id} not found`);
  }
}
