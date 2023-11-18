import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Transactional } from '../../../src';
import { User } from '../database';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    readonly userRepository: Repository<User>,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    @InjectDataSource() private readonly dataSoruce: DataSource,
  ) {}

  @Transactional()
  async createUser(id: string) {
    const user = User.create({
      id,
    });

    await this.userRepository.createQueryBuilder().insert().into(User).values(user).execute();
  }

  @Transactional()
  async updateUser(userId: string, data: Partial<User>) {
    // const updateResult = await this.userRepository.update(userId, data);
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
