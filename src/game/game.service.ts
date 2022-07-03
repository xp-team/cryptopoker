import {
  ForbiddenException,
  Injectable,
  Logger,
  NotAcceptableException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import _ from 'lodash';
import { Model } from 'mongoose';
import { Card, Hand, Table } from 'poker';

import { ConnectGameDto } from './dto/connect-game.dto';
import { CreateGameDto } from './dto/create-game.dto';
import { TakeActionDto } from './dto/take-action.dto';
import { Game, GameDocument } from './schemas/game.schema';

export interface IntermediateResult {
  communityCards: Card[];
  playerACards: Hand | null;
  playerBCards: Hand | null;
  winner: number[];
}

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

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

  async connectGame(
    connectGameDto: ConnectGameDto,
  ): Promise<IntermediateResult> {
    let game = await this.gameModel.findOneAndUpdate(
      {
        _id: connectGameDto.gameId,
        playerB: null,
        playerBChat: null,
      },
      {
        playerB: connectGameDto.playerBId,
        playerBChat: connectGameDto.chatBId,
      },
    );
    game = await this.gameModel.findOne({
      _id: connectGameDto.gameId,
    });
    if (game === null)
      throw new NotFoundException(`Game #${connectGameDto.gameId} not found`);

    await this.resetGame(connectGameDto.gameId);
    const gameInstance = this.openedGames[connectGameDto.gameId];

    return {
      playerACards: _.cloneDeep(gameInstance.holeCards()[0]),
      playerBCards: _.cloneDeep(gameInstance.holeCards()[0]),
      communityCards: _.cloneDeep(gameInstance.communityCards()),
      winner: [],
    };
  }

  async takeGameAction(
    takeActionDto: TakeActionDto,
  ): Promise<IntermediateResult> {
    if (!(takeActionDto.gameId in this.openedGames))
      throw new NotFoundException(`Game #${takeActionDto.gameId} not found`);

    let game = await this.gameModel.findOne({
      _id: takeActionDto.gameId,
    });

    if (game === null)
      throw new NotFoundException(`Game #${takeActionDto.gameId} not found`);
    else if (
      !(
        game.playerA === takeActionDto.playerId ||
        game.playerB === takeActionDto.playerId
      )
    )
      throw new ForbiddenException(`Your not playing this game`);
    else if (game.turnFor !== takeActionDto.playerId)
      throw new NotAcceptableException(`It's not your turn`);

    let gameInstance = this.openedGames[takeActionDto.gameId];

    try {
      if (takeActionDto.betSize)
        gameInstance.actionTaken(takeActionDto.action, takeActionDto.betSize);
      else gameInstance.actionTaken(takeActionDto.action);
    } catch (e) {
      this.logger.error(e);
      throw new NotAcceptableException(e);
    }

    if (gameInstance.isBettingRoundInProgress() === false)
      gameInstance.endBettingRound();

    let playerACards: Hand | null = null;
    let playerBCards: Hand | null = null;
    let communityCards = [];
    const seatA = gameInstance.seats()[0];
    const seatB = gameInstance.seats()[1];

    try {
      playerACards = _.cloneDeep(gameInstance.holeCards()[0]);
      playerBCards = _.cloneDeep(gameInstance.holeCards()[0]);
      communityCards = _.cloneDeep(gameInstance.communityCards());
    } catch {}

    try {
      gameInstance.showdown();

      await this.gameModel.updateOne(
        { _id: game.id },
        {
          playerABalance: seatA.totalChips,
          playerBBalance: seatB.totalChips,
        },
      );

      if (
        gameInstance.seats()[0].totalChips === game.playerABalance &&
        gameInstance.seats()[1].totalChips === game.playerBBalance
      ) {
        await this.resetGame(game.id);
        gameInstance = this.openedGames[takeActionDto.gameId];
        return {
          playerACards: _.cloneDeep(gameInstance.holeCards()[0]),
          playerBCards: _.cloneDeep(gameInstance.holeCards()[0]),
          communityCards: _.cloneDeep(gameInstance.communityCards()),
          winner: [game.playerA, game.playerB],
        };
      } else if (gameInstance.seats()[0].totalChips > game.playerABalance) {
        await this.resetGame(game.id);
        gameInstance = this.openedGames[takeActionDto.gameId];
        return {
          playerACards: _.cloneDeep(gameInstance.holeCards()[0]),
          playerBCards: _.cloneDeep(gameInstance.holeCards()[0]),
          communityCards: _.cloneDeep(gameInstance.communityCards()),
          winner: [game.playerA],
        };
      } else {
        await this.resetGame(game.id);
        gameInstance = this.openedGames[takeActionDto.gameId];
        return {
          playerACards: _.cloneDeep(gameInstance.holeCards()[0]),
          playerBCards: _.cloneDeep(gameInstance.holeCards()[0]),
          communityCards: _.cloneDeep(gameInstance.communityCards()),
          winner: [game.playerB],
        };
      }
    } catch {}

    const pot = gameInstance.pots()[0];
    if (pot.eligiblePlayers.length === 1) {
      // We have a winner

      game = await this.gameModel.findOneAndUpdate(
        {
          _id: game.id,
        },
        pot.eligiblePlayers[0] === 0
          ? {
              playerABalance: game.playerABalance + pot.size,
              playerBBalance: game.playerBBalance - pot.size,
            }
          : {
              playerABalance: game.playerABalance + pot.size,
              playerBBalance: game.playerBBalance - pot.size,
            },
      );

      await this.resetGame(game.id);
      gameInstance = this.openedGames[takeActionDto.gameId];
      return {
        playerACards: _.cloneDeep(gameInstance.holeCards()[0]),
        playerBCards: _.cloneDeep(gameInstance.holeCards()[0]),
        communityCards: _.cloneDeep(gameInstance.communityCards()),
        winner: [pot.eligiblePlayers[0] === 0 ? game.playerA : game.playerB],
      };
    } else {
      await this.gameModel.updateOne(
        {
          _id: takeActionDto.gameId,
        },
        {
          turnFor: game.turnFor === game.playerA ? game.playerB : game.playerA,
          playerABalance: seatA.totalChips,
          playerBBalance: seatB.totalChips,
        },
      );

      return {
        communityCards,
        playerACards,
        playerBCards,
        winner: [],
      };
    }
  }

  private async resetGame(gameId: string) {
    const game = await this.gameModel.findOne({
      _id: gameId,
    });
    const gameInstance = new Table({
      ante: 0,
      smallBlind: 1,
      bigBlind: 2,
    });

    this.openedGames[gameId] = gameInstance;
    gameInstance.sitDown(0, game.playerABalance);
    gameInstance.sitDown(1, game.playerBBalance);
    gameInstance.startHand();

    await this.gameModel.updateOne(
      {
        _id: game.id,
      },
      {
        turnFor: game.playerA,
      },
    );
  }
}
