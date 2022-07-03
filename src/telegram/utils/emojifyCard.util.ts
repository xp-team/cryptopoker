import { Card, Hand } from 'poker';

export function emojifyCard(cardOrHand: Card | Hand) {
  let card: Card | null = null;
  let hand: Hand | null = null;
  if ('suit' in card && 'rank' in card) card = cardOrHand as Card;
  else hand = cardOrHand as Hand;

  if (card)
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
  else return [emojifyCard(hand.first), emojifyCard(hand.second)];
}
