import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectEntityManager } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { User } from '../database';

@Injectable()
export class WithoutTransactionalService {
  constructor(
    @InjectRepository(User)
    readonly userRepository: Repository<User>,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
  ) {}

  async createUser(id: string) {
    const user = User.create({
      id,
    });

    await this.userRepository.createQueryBuilder().insert().into(User).values(user).execute();

    return id;
  }

  async updateUser(userId: string, data: Partial<User>) {
    const updateResult = await this.userRepository.update(userId, data);

    if (!updateResult?.affected) {
      throw new NotFoundException();
    }
  }

  async deleteUser(userId: string) {
    const deleteResult = await this.userRepository.delete(userId);

    if (!deleteResult?.affected) {
      throw new NotFoundException();
    }
  }
}
