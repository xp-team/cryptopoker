import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GameDocument = Game & Document;

@Schema()
export class Game {
  @Prop({ required: true })
  playerA: number;

  @Prop({ default: null })
  playerB: number;
}

export const GameSchema = SchemaFactory.createForClass(Game);
