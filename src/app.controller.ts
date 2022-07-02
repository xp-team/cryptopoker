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
import { Table } from 'poker';

import { ConnectGameDto } from './dto/connect-game.dto';
import { CreateGameDto } from './dto/create-game.dto';
import { TakeActionDto } from './dto/take-action.dto';
import { Game, GameDocument } from './schemas/game.schema';

@Controller()
export class AppController {
  private openedGames: { [key: string]: Table } = {};

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

    const gameInstance = new Table({
      ante: 0,
      smallBlind: 1,
      bigBlind: 2,
    });
    gameInstance.sitDown(0, 100);
    gameInstance.sitDown(1, 100);
    gameInstance.startHand();
    this.openedGames[gameId] = gameInstance;
  }

  @Post('action/:gameId')
  async takeGameAction(
    @Param('gameId') gameId: string,
    @Body() takeActionDto: TakeActionDto,
  ) {
    if (!(gameId in this.openedGames))
      throw new NotFoundException(`Game #${gameId} not found`);

    const gameInstance = this.openedGames[gameId];

    if (takeActionDto.betSize)
      gameInstance.actionTaken(takeActionDto.action, takeActionDto.betSize);
    else gameInstance.actionTaken(takeActionDto.action);

    if (gameInstance.isBettingRoundInProgress() === false)
      gameInstance.endBettingRound();
  }

  @Get('status/:gameId')
  async getGameStatus(@Param('gameId') gameId: string) {
    if (!(gameId in this.openedGames))
      throw new NotFoundException(`Game #${gameId} not found`);

    const gameInstance = this.openedGames[gameId];

    return {
      isBettingRoundInProgress: gameInstance.isBettingRoundInProgress(),
      isHandInProgress: gameInstance.isHandInProgress(),
      playerA: gameInstance.holeCards()[0],
      playerB: gameInstance.holeCards()[1],
      communityCards: gameInstance.communityCards(),
    };
  }

  @Post('telegram')
  async telegramTest() {
    await this.telegram
      .sendMessage({
        chat_id: 302899890,
        text: 'Bye looser',
      })
      .toPromise();
    console.log(
      JSON.stringify(
        await this.telegram.getUpdates({ offset: 809729069 }).toPromise(),
        null,
        2,
      ),
    );
  }
}
