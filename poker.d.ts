declare module 'poker' {
  declare class Table {
    constructor(forcedBets: {
      ante: number;
      smallBlind: number;
      bigBlind: number;
    });

    sitDown(seatIndex: number, buyIn: number): void;
    startHand(): void;
    actionTaken(
      action: 'fold' | 'check' | 'call' | 'bet' | 'raise',
      betSize?: number,
    ): void;
    isBettingRoundInProgress(): boolean;
    isHandInProgress(): boolean;
    holeCards(): {
      first: Card;
      second: Card;
    }[];
    communityCards(): Card[];
    endBettingRound(): void;
  }
}

interface Card {
  rank: CardRank;
  suit: CardSuit;
}

type CardRank =
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'T'
  | 'J'
  | 'Q'
  | 'K'
  | 'A';

type CardSuit = 'spades' | 'hearts' | 'clubs' | 'diamonds';
