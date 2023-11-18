import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../base.entity';

@Entity()
export class Log extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: number;
}
