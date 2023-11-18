import { DataSource } from 'typeorm';
import { addTransactionalDataSource, IsolationLevel, runInTransaction } from '../src';
import { Counter, mainDataSourceOpiton, User } from './fixtures';

const dataSource = new DataSource(mainDataSourceOpiton);

addTransactionalDataSource(dataSource);

beforeAll(async () => {
  await dataSource.initialize();
});

afterAll(async () => {
  await dataSource.destroy();
});

describe('Transactional', () => {
  beforeEach(async () => {
    await dataSource.createEntityManager().clear(User);
    await dataSource.createEntityManager().clear(Counter);
  });

  describe('Isolation', () => {
    const userFixtureId = '75fb75f6-8421-4a4e-991b-7762e8b63a4c';

    it('should read the most recent committed rows when using READ COMMITTED isolation level', async () => {
      await runInTransaction(
        async () => {
          const userRepository = dataSource.getRepository(User);
          const totalUsers = await userRepository.count();
          expect(totalUsers).toBe(0);

          await dataSource.transaction(async (manager) => {
            await manager.save(User.create(userFixtureId));
          });

          const totalUsers2 = await userRepository.count();
          expect(totalUsers2).toBe(1);
        },
        { isolationLevel: IsolationLevel.READ_COMMITTED },
      );
    });

    it("shouldn't see the most recent committed rows when using REPEATABLE READ isolation level", async () => {
      await runInTransaction(
        async () => {
          const userRepository = dataSource.getRepository(User);

          const notExistUser = await userRepository.findOneBy({
            id: userFixtureId,
          });
          expect(notExistUser).toBe(null);

          await dataSource.transaction(async (manager) => {
            await manager.save(User.create(userFixtureId));
          });

          const stillNotExistUser = await userRepository.findOneBy({
            id: userFixtureId,
          });
          expect(stillNotExistUser).toBe(null);
        },
        { isolationLevel: IsolationLevel.REPEATABLE_READ },
      );
    });
  });
});
