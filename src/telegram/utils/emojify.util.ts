import { Card, Hand } from 'poker';

export function emojifyCard(card: Card): string {
  switch (card.suit) {
    case 'clubs':
      return `♣️ ${card.rank}`;
    case 'diamonds':
      return `♦️ ${card.rank}`;
    case 'hearts':
      return `♥️ ${card.rank}`;
    case 'spades':
      return `♠️ ${card.rank}`;
  }
}

export function emojifyHand(hand: Hand): string[] {
  return [emojifyCard(hand.first), emojifyCard(hand.second)];
}
