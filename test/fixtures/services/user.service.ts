import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Transactional } from '../../../src';
import { User, UserImage } from '../database';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    readonly userRepository: Repository<User>,
    @InjectDataSource() private readonly dataSoruce: DataSource,
  ) {}

  @Transactional()
  async createUser(id?: string) {
    const user = User.create({
      id,
    });

    await this.userRepository
      .createQueryBuilder()
      .insert()
      .into(User)
      .values({
        ...user,
        imageList: [UserImage.create()],
      })
      .execute();

    // await this.s3Service.insertImage(param1, param2, param3);
  }

  @Transactional()
  async updateUser(userId: string, data: Partial<User>) {
    const updateResult = await this.dataSoruce.manager.update(User, userId, data);

    if (!updateResult?.affected) {
      throw new NotFoundException();
    }
  }

  @Transactional()
  async deleteUser(userId: string) {
    const deleteResult = await this.userRepository.delete(userId);

    if (!deleteResult?.affected) {
      throw new NotFoundException();
    }
  }
}
