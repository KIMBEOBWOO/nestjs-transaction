import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../base.entity';

@Entity('log')
export class Log extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  static create(input?: string) {
    const log = new Log();

    if (input) {
      log.id = input;
    }

    return log;
  }
}
