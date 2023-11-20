import { Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('user_images')
export class UserImage {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ManyToOne(() => User, (user) => user.imageList, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  user: User;

  static create() {
    const userImage = new UserImage();
    return userImage;
  }
}
