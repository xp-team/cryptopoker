import { Injectable, Logger, NotAcceptableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import _ from 'lodash';
import { Model } from 'mongoose';
import { TelegramService as TelegramServiceNest } from 'nestjs-telegram';
import { ActionTypes } from 'poker';

import { GameService, IntermediateResult } from '../game/game.service';
import { Game, GameDocument } from '../game/schemas/game.schema';
import { emojifyCard, emojifyHand } from './utils/emojify.util';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  private inProgress = false;
  private lastUpdate = 0;

  constructor(
    private readonly telegram: TelegramServiceNest,
    private readonly gameService: GameService,
    @InjectModel(Game.name) private readonly gameModel: Model<GameDocument>,
  ) {}

  @Cron(CronExpression.EVERY_SECOND)
  async handleCron() {
    if (!this.inProgress) {
      this.inProgress = true;
      await this.handleTelegramUpdates();
      this.inProgress = false;
    }
  }

  async handleTelegramUpdates() {
    const updates = await this.telegram
      .getUpdates({
        offset: this.lastUpdate,
      })
      .toPromise();

    if (updates.length) this.lastUpdate = _.last(updates).update_id + 1;

    for (const update of updates) {
      if (!update.message) continue;

      if (update.message.text === 'Available games') {
        const games = await this.gameService.games();

        if (games.length === 0)
          await this.telegram
            .sendMessage({
              chat_id: update.message.chat.id,
              text: `No available games. 
Wait a little and try again or create one by your own`,
              reply_markup: {
                resize_keyboard: true,
                force_reply: true,
                keyboard: [
                  [{ text: 'Available games' }],
                  [{ text: 'Create game' }],
                ],
              },
            })
            .toPromise();
        else
          await this.telegram
            .sendMessage({
              chat_id: update.message.chat.id,
              text: 'Available games:',
              reply_markup: {
                resize_keyboard: true,
                force_reply: true,
                keyboard: [
                  [{ text: '🔙 Go back' }],
                  ...games.map((g) => [{ text: `Connect/${g.id}` }]),
                ],
              },
            })
            .toPromise();
      } else if (update.message.text.startsWith('Connect/')) {
        /**
         * TODO: Add crypto hook (after all check below)
         */

        const match = update.message.text.match(/(?<=Connect\/).*/);
        if (match === null) {
          await this.telegram
            .sendMessage({
              chat_id: update.message.chat.id,
              text: 'Invalid input',
              reply_markup: {
                resize_keyboard: true,
                keyboard: [
                  [{ text: 'Available games' }],
                  [{ text: 'Create game' }],
                ],
              },
            })
            .toPromise();
          continue;
        }

        let game: GameDocument | null = null;
        let res: IntermediateResult | null = null;
        try {
          res = await this.gameService.connectGame({
            gameId: match[0],
            playerBId: update.message.from.id,
            chatBId: update.message.chat.id,
          });
          game = await this.gameModel.findOne({ _id: match[0] });
        } catch (e) {
          this.logger.error(e);
          await this.telegram
            .sendMessage({
              chat_id: update.message.chat.id,
              text: `Could not connect to the game ${match[0]}`,
              reply_markup: {
                resize_keyboard: true,
                keyboard: [
                  [{ text: 'Available games' }],
                  [{ text: 'Create game' }],
                ],
              },
            })
            .toPromise();
          continue;
        }

        const playerACards = emojifyHand(res.playerACards).join('|');
        const playerBCards = emojifyHand(res.playerBCards).join('|');

        await this.telegram
          .sendMessage({
            chat_id: game.playerAChat,
            text: `Community cards: <no opened yet>
Your cards: ${playerACards}
It's your turn`,
            reply_markup: {
              resize_keyboard: true,
              keyboard: [
                [{ text: `Action/${game.id}/fold` }],
                [{ text: `Action/${game.id}/check` }],
                [{ text: `Action/${game.id}/call` }],
                [{ text: `Action/${game.id}/bet` }],
                [{ text: `Action/${game.id}/raise` }],
              ],
            },
          })
          .toPromise();
        await this.telegram
          .sendMessage({
            chat_id: game.playerBChat,
            text: `Community cards: <not opened yet>
Your cards: ${playerBCards}
It's your turn`,
            reply_markup: {
              resize_keyboard: true,
              keyboard: [
                [{ text: `Action/${game.id}/fold` }],
                [{ text: `Action/${game.id}/check` }],
                [{ text: `Action/${game.id}/call` }],
                [{ text: `Action/${game.id}/bet` }],
                [{ text: `Action/${game.id}/raise` }],
              ],
            },
          })
          .toPromise();
      } else if (update.message.text === 'Create game') {
        const game = await this.gameService.createGame({
          playerAId: update.message.from.id,
          chatAId: update.message.chat.id,
        });
        await this.telegram
          .sendMessage({
            chat_id: update.message.chat.id,
            text: `Created game ${game.id}. Now wait until someone connect to it.`,
            reply_markup: {
              resize_keyboard: true,
              keyboard: [
                [{ text: 'Available games' }],
                [{ text: 'Create game' }],
              ],
            },
          })
          .toPromise();
      } else if (update.message.text.startsWith('Action/')) {
        const match = update.message.text.match(
          /Action\/(.+)\/(fold|check|call|betn|raise)/,
        );
        if (match === null) {
          await this.telegram
            .sendMessage({
              chat_id: update.message.chat.id,
              text: 'Invalid input',
              reply_markup: {
                resize_keyboard: true,
                keyboard: [
                  [{ text: 'Available games' }],
                  [{ text: 'Create game' }],
                ],
              },
            })
            .toPromise();
          continue;
        }
        const [, gameId, action] = match as [string, string, ActionTypes];
        try {
          const res = await this.gameService.takeGameAction({
            action,
            gameId,
            playerId: update.message.from.id,
            betSize: action === 'bet' || action === 'raise' ? 5 : undefined,
          });

          const game = await this.gameModel.findOne({ _id: gameId });
          const communityCards = res.communityCards.map(emojifyCard).join('|');
          const playerACards = emojifyHand(res.playerACards).join('|');
          const playerBCards = emojifyHand(res.playerBCards).join('|');

          const draw = res.winner.length === 2;
          const playerAWon =
            res.winner.length === 1 && res.winner[0] === game.playerA;
          const playerBWon =
            res.winner.length === 1 && res.winner[0] === game.playerB;

          if (draw) {
            await this.telegram
              .sendMessage({
                chat_id: game.playerAChat,
                text: `It's draw. 
Started a new game. It's your turn.
Community cards: ${communityCards}
Your cards: ${playerACards}`,
                reply_markup: {
                  resize_keyboard: true,
                  keyboard: [
                    [{ text: `Action/${gameId}/fold` }],
                    [{ text: `Action/${gameId}/check` }],
                    [{ text: `Action/${gameId}/call` }],
                    [{ text: `Action/${gameId}/bet` }],
                    [{ text: `Action/${gameId}/raise` }],
                  ],
                },
              })
              .toPromise();
            await this.telegram
              .sendMessage({
                chat_id: game.playerBChat,
                text: `It's draw. 
Started a new game. It's opponent's turn.
Community cards: ${communityCards}
Your cards: ${playerBCards}`,
                reply_markup: {
                  resize_keyboard: true,
                  keyboard: [
                    [{ text: `Action/${gameId}/fold` }],
                    [{ text: `Action/${gameId}/check` }],
                    [{ text: `Action/${gameId}/call` }],
                    [{ text: `Action/${gameId}/bet` }],
                    [{ text: `Action/${gameId}/raise` }],
                  ],
                },
              })
              .toPromise();
          } else if (playerAWon) {
            await this.telegram
              .sendMessage({
                chat_id: game.playerAChat,
                text: `You won. 
Started a new game. It's your turn.
Community cards: ${communityCards}
Your cards: ${playerACards}`,
                reply_markup: {
                  resize_keyboard: true,
                  keyboard: [
                    [{ text: `Action/${gameId}/fold` }],
                    [{ text: `Action/${gameId}/check` }],
                    [{ text: `Action/${gameId}/call` }],
                    [{ text: `Action/${gameId}/bet` }],
                    [{ text: `Action/${gameId}/raise` }],
                  ],
                },
              })
              .toPromise();
            await this.telegram
              .sendMessage({
                chat_id: game.playerBChat,
                text: `You lost. 
Started a new game. It's opponent's turn.
Community cards: ${communityCards}
Your cards: ${playerBCards}`,
                reply_markup: {
                  resize_keyboard: true,
                  keyboard: [
                    [{ text: `Action/${gameId}/fold` }],
                    [{ text: `Action/${gameId}/check` }],
                    [{ text: `Action/${gameId}/call` }],
                    [{ text: `Action/${gameId}/bet` }],
                    [{ text: `Action/${gameId}/raise` }],
                  ],
                },
              })
              .toPromise();
          } else if (playerBWon) {
            await this.telegram
              .sendMessage({
                chat_id: game.playerAChat,
                text: `You lost. 
Started a new game. It's your turn.
Community cards: ${communityCards}
Your cards: ${playerACards}`,
                reply_markup: {
                  resize_keyboard: true,
                  keyboard: [
                    [{ text: `Action/${gameId}/fold` }],
                    [{ text: `Action/${gameId}/check` }],
                    [{ text: `Action/${gameId}/call` }],
                    [{ text: `Action/${gameId}/bet` }],
                    [{ text: `Action/${gameId}/raise` }],
                  ],
                },
              })
              .toPromise();
            await this.telegram
              .sendMessage({
                chat_id: game.playerBChat,
                text: `You won. 
Started a new game. It's opponent's turn.
Community cards: ${communityCards}
Your cards: ${playerBCards}`,
                reply_markup: {
                  resize_keyboard: true,
                  keyboard: [
                    [{ text: `Action/${gameId}/fold` }],
                    [{ text: `Action/${gameId}/check` }],
                    [{ text: `Action/${gameId}/call` }],
                    [{ text: `Action/${gameId}/bet` }],
                    [{ text: `Action/${gameId}/raise` }],
                  ],
                },
              })
              .toPromise();
          } else {
            await this.telegram
              .sendMessage({
                chat_id: game.playerAChat,
                text: `${
                  game.turnFor === game.playerA
                    ? "It's your turn"
                    : "It's opponent's turn"
                }.
Community cards: ${communityCards}
Your cards: ${playerACards}`,
                reply_markup: {
                  resize_keyboard: true,
                  keyboard: [
                    [{ text: `Action/${gameId}/fold` }],
                    [{ text: `Action/${gameId}/check` }],
                    [{ text: `Action/${gameId}/call` }],
                    [{ text: `Action/${gameId}/bet` }],
                    [{ text: `Action/${gameId}/raise` }],
                  ],
                },
              })
              .toPromise();
            await this.telegram
              .sendMessage({
                chat_id: game.playerBChat,
                text: `${
                  game.turnFor === game.playerB
                    ? "It's your turn"
                    : "It's opponent's turn"
                }.
Community cards: ${communityCards}
Your cards: ${playerBCards}`,
                reply_markup: {
                  resize_keyboard: true,
                  keyboard: [
                    [{ text: `Action/${gameId}/fold` }],
                    [{ text: `Action/${gameId}/check` }],
                    [{ text: `Action/${gameId}/call` }],
                    [{ text: `Action/${gameId}/bet` }],
                    [{ text: `Action/${gameId}/raise` }],
                  ],
                },
              })
              .toPromise();
          }
        } catch (e) {
          this.logger.error(e);

          if (e instanceof NotAcceptableException) {
            await this.telegram
              .sendMessage({
                chat_id: update.message.chat.id,
                text: "It's probably not your turn or you selected an illegal action",
                reply_markup: {
                  resize_keyboard: true,
                  keyboard: [
                    [{ text: `Action/${gameId}/fold` }],
                    [{ text: `Action/${gameId}/check` }],
                    [{ text: `Action/${gameId}/call` }],
                    [{ text: `Action/${gameId}/bet` }],
                    [{ text: `Action/${gameId}/raise` }],
                  ],
                },
              })
              .toPromise();
          } else {
            await this.telegram
              .sendMessage({
                chat_id: update.message.chat.id,
                text: "Probably, picked game doesn't exist or you not part of it",
                reply_markup: {
                  resize_keyboard: true,
                  keyboard: [
                    [{ text: 'Available games' }],
                    [{ text: 'Create game' }],
                  ],
                },
              })
              .toPromise();
          }
        }
      } else {
        await this.telegram
          .sendMessage({
            chat_id: update.message.chat.id,
            text: "We didn't understand you. Please, try the commands below",
            reply_markup: {
              resize_keyboard: true,
              keyboard: [
                [{ text: 'Available games' }],
                [{ text: 'Create game' }],
              ],
            },
          })
          .toPromise();
      }
    }
  }
}
