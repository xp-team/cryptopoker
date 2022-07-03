import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GameDocument = Game & Document;

@Schema()
export class Game {
  @Prop({ required: true })
  playerA: number;

  @Prop({ required: true })
  playerAChat: number;

  @Prop({ default: null })
  playerB: number;

  @Prop({ default: null })
  playerBChat: number;
}

export const GameSchema = SchemaFactory.createForClass(Game);
