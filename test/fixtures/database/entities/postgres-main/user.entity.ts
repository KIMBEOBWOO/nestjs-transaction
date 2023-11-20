import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { faker } from '@faker-js/faker';
import { UserImage } from './user-image.entity';

@Entity('user')
export class User extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  email!: string;

  @OneToMany(() => UserImage, (userImage) => userImage.user, {
    cascade: true,
  })
  imageList: UserImage[];

  static create(input?: string | Partial<User>): User {
    const user = new User();
    let data: Partial<User> | undefined = undefined;

    if (input !== undefined && typeof input === 'string') {
      data = { id: input };
    } else {
      data = input;
    }

    const now = new Date();

    user.id = data?.id || faker.string.uuid();
    user.email = data?.email || faker.internet.email({});
    user.created_at = data?.created_at || now;
    user.updated_at = data?.updated_at || now;
    user.deleted_at = null;

    return user;
  }
}
