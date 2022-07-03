import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import _ from 'lodash';
import { TelegramService as TelegramServiceNest } from 'nestjs-telegram';

import { GameService } from '../game/game.service';

@Injectable()
export class TelegramService {
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

      if (update.message.text === 'Hello')
        await this.telegram
          .sendMessage({
            chat_id: update.message.chat.id,
            text: 'You said Hello',
            reply_markup: {
              keyboard: [
                [{ text: 'Search for games' }],
                [{ text: 'Create game' }],
              ],
            },
          })
          .toPromise();
      else
        await this.telegram
          .sendMessage({
            chat_id: update.message?.chat.id,
            text: 'You said something else',
          })
          .toPromise();
    }
  }
}
