import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GameDocument = Game & Document;

@Schema()
export class Game {
  @Prop()
  owner: string;

  @Prop({ default: true })
  opened: boolean;
}

export const GameSchema = SchemaFactory.createForClass(Game);
