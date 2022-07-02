import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TelegramService } from 'nestjs-telegram';

import { ConnectGameDto } from './dto/connect-game.dto';
import { CreateGameDto } from './dto/create-game.dto';
import { Game, GameDocument } from './schemas/game.schema';

@Controller()
export class AppController {
  constructor(
    @InjectModel(Game.name) private readonly gameModel: Model<GameDocument>,
    private readonly telegram: TelegramService,
  ) {}

  @Get()
  games(): Promise<Game[]> {
    return this.gameModel
      .find({ $or: [{ playerA: null }, { playerB: null }] })
      .exec();
  }

  @Post('create')
  createGame(@Body() createGameDto: CreateGameDto): Promise<Game> {
    const createdGame = new this.gameModel({
      playerA: createGameDto.playerAId,
    });
    return createdGame.save();
  }

  @Post('connect/:gameId')
  async connectGame(
    @Param('gameId') gameId: string,
    @Body() connectGameDto: ConnectGameDto,
  ) {
    const game = await this.gameModel.findOneAndUpdate(
      {
        _id: gameId,
        playerB: null,
      },
      { playerB: connectGameDto.playerBId },
    );

    if (game === null) throw new NotFoundException(`Game #${gameId} not found`);
  }

  @Post('telegram')
  async telegramTest() {
    console.log(
      JSON.stringify(
        await this.telegram.getUpdates({ offset: 809729069 }).toPromise(),
        null,
        2,
      ),
    );
  }
}
