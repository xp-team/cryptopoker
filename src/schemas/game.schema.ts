import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GameDocument = Game & Document;

@Schema()
export class Game {
  @Prop()
  playerA: number;

  @Prop()
  playerB: number;
}

export const GameSchema = SchemaFactory.createForClass(Game);
