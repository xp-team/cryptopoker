export class TakeActionDto {
  action: 'fold' | 'check' | 'call' | 'bet' | 'raise';
  betSize?: number;
  gameId: string;
}
