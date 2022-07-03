import { Injectable, Logger, NotAcceptableException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import _ from 'lodash';
import { TelegramService as TelegramServiceNest } from 'nestjs-telegram';
import { ActionTypes } from 'poker';

import { GameService } from '../game/game.service';
import { GameDocument } from '../game/schemas/game.schema';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  private inProgress = false;
  private lastUpdate = 0;

  constructor(
    private readonly telegram: TelegramServiceNest,
    private readonly gameService: GameService,
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
        await this.telegram
          .sendMessage({
            chat_id: update.message.chat.id,
            text: 'Available games:',
            reply_markup: {
              resize_keyboard: true,
              force_reply: true,
              keyboard: (
                await this.gameService.games()
              ).map((g) => [{ text: `Connect/${g.id}` }]),
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

        let game: GameDocument = null;
        try {
          game = await this.gameService.connectGame({
            gameId: match[0],
            playerBId: update.message.from.id,
            chatBId: update.message.chat.id,
          });
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

        await this.telegram
          .sendMessage({
            chat_id: update.message.chat.id,
            text: "Pre-flop. House money: 3 TON. Your money: 98 TON. It's turn of player A",
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
            chat_id: game.playerAChat,
            text: "Pre-flop. House money: 3 TON. Your money: 99 TON. It's your turn",
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
          await this.gameService.takeGameAction({
            action,
            gameId,
            playerId: update.message.from.id,
            betSize: action === 'bet' || action === 'raise' ? 5 : undefined,
          });
        } catch (e) {
          this.logger.error(e);

          if (e instanceof NotAcceptableException) {
            await this.telegram
              .sendMessage({
                chat_id: update.message.chat.id,
                text: "It's probably not your turn or you clicked illegal action",
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
                text: "Probably game doesn't exist or you not part of it",
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
