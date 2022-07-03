import { ActionTypes } from 'poker';

export class TakeActionDto {
  action: ActionTypes;
  betSize?: number;
  gameId: string;
  playerId: number;
}
