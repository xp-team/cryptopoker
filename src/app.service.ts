import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import _ from 'lodash';
import { TelegramService } from 'nestjs-telegram';

@Injectable()
export class AppService {
  private inProgress = false;
  private lastUpdate = 0;

  constructor(private readonly telegram: TelegramService) {}

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
      if (update.message && update.message.text === 'Hello')
        await this.telegram
          .sendMessage({
            chat_id: update.message.chat.id,
            text: 'You said Hello',
          })
          .toPromise();
      else if (update.message)
        await this.telegram
          .sendMessage({
            chat_id: update.message?.chat.id,
            text: 'You said something else',
          })
          .toPromise();
    }
  }
}
