import { DataSource } from 'typeorm';
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { User } from '../entities';

export const defaultUser = () => {
  const user = new User();
  user.id = '9d994156-bcb0-49a7-b37d-cbe293731160';
  user.email = '123123123@naver.com';

  return user;
};

export default class UserSeeder implements Seeder {
  public async run(dataSource: DataSource, factoryManager: SeederFactoryManager): Promise<void> {
    const repository = dataSource.getRepository(User);
    await repository.remove(await repository.find());
    await repository.save(defaultUser());

    /**
     * save random 5 Users
     */
    const userFactory = factoryManager.get(User);
    await userFactory.saveMany(5);
  }
}
