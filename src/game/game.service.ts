import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Table } from 'poker';

import { ConnectGameDto } from './dto/connect-game.dto';
import { CreateGameDto } from './dto/create-game.dto';
import { TakeActionDto } from './dto/take-action.dto';
import { Game, GameDocument } from './schemas/game.schema';

@Injectable()
export class GameService {
  private openedGames: { [key: string]: Table } = {};

  constructor(
    @InjectModel(Game.name) private readonly gameModel: Model<GameDocument>,
  ) {}

  games(): Promise<GameDocument[]> {
    return this.gameModel
      .find({ $or: [{ playerA: null }, { playerB: null }] })
      .exec();
  }

  createGame(createGameDto: CreateGameDto): Promise<GameDocument> {
    const createdGame = new this.gameModel({
      playerA: createGameDto.playerAId,
      playerAChat: createGameDto.chatAId,
    });
    return createdGame.save();
  }

  async connectGame(connectGameDto: ConnectGameDto) {
    const game = await this.gameModel.findOneAndUpdate(
      {
        _id: connectGameDto.gameId,
        playerB: null,
      },
      { playerB: connectGameDto.playerBId },
    );

    if (game === null)
      throw new NotFoundException(`Game #${connectGameDto.gameId} not found`);

    const gameInstance = new Table({
      ante: 0,
      smallBlind: 1,
      bigBlind: 2,
    });
    gameInstance.sitDown(0, 100);
    gameInstance.sitDown(1, 100);
    gameInstance.startHand();
    this.openedGames[connectGameDto.gameId] = gameInstance;
  }

  async takeGameAction(takeActionDto: TakeActionDto) {
    if (!(takeActionDto.gameId in this.openedGames))
      throw new NotFoundException(`Game #${takeActionDto.gameId} not found`);

    const gameInstance = this.openedGames[takeActionDto.gameId];

    if (takeActionDto.betSize)
      gameInstance.actionTaken(takeActionDto.action, takeActionDto.betSize);
    else gameInstance.actionTaken(takeActionDto.action);

    if (gameInstance.isBettingRoundInProgress() === false)
      gameInstance.endBettingRound();
  }

  async getGameStatus(gameId: string) {
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
}
