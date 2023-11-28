import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { runInTransaction, TestTransactionModule } from '../src';
import { AppModule, RollbackError, User, UsingCallbackService } from './fixtures';

describe('@Transactional UseCase in Nest.js', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const fixureUserId = '27ff4cfc-7656-428c-8da4-918424925c38';
  const fixureUserId2 = '95ce2449-adee-47bb-a068-29d4d3f1b721';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule, TestTransactionModule.forRoot()],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    dataSource = app.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  beforeEach(async () => {
    /**
     * To test the Support Propagation option correctly, a top-level transaction-free environment must be configured.
     * Use explicit queries to remove test data because rollback processing with testQueryRunner should not be used
     */
    await dataSource.query('TRUNCATE public.user CASCADE');
  });

  describe('Required', () => {
    it('If there is an ongoing transaction, must participate.', async () => {
      const service = app.get(UsingCallbackService);
      const manager = dataSource.createEntityManager();

      try {
        await runInTransaction(async () => {
          await service.createAndUpdateUserRequied(fixureUserId, fixureUserId2);
          throw new RollbackError('Roll back');
        });
      } catch (e) {
        if (!(e instanceof RollbackError)) throw e;
      }

      const userFixtures = await manager.find(User);
      expect(userFixtures).toStrictEqual([]);
    });

    it('Commit should be done if it is handled normally.', async () => {
      const service = app.get(UsingCallbackService);
      const manager = dataSource.createEntityManager();

      await service.createAndUpdateUserRequied(fixureUserId, fixureUserId2);

      const userFixture = await manager.findOneBy(User, {
        id: fixureUserId,
      });
      expect(userFixture).toBeDefined();
    });

    it('If an error occurs, it should be rolled back all', async () => {
      const service = app.get(UsingCallbackService);

      try {
        await service.createAndUpdateUserRequied(fixureUserId, fixureUserId2, () => {
          throw new RollbackError('Roll back!');
        });
      } catch (e) {
        if (!(e instanceof RollbackError)) throw e;
      }

      const manager = dataSource.createEntityManager();

      const userFixtures = await manager.find(User);
      expect(userFixtures).toStrictEqual([]);
    });
  });

  describe('Support', () => {
    it('If there is an ongoing transaction, must participate.', async () => {
      const service = app.get(UsingCallbackService);
      const manager = dataSource.createEntityManager();

      try {
        await service.createAndUpdateUserRequied(fixureUserId, fixureUserId2, async () => {
          await service.createAndUpdateUserSupports('42105270-e444-4626-a784-fc0259d9da8f');
          throw new RollbackError();
        });
      } catch (e) {
        if (!(e instanceof RollbackError)) throw e;
      }

      const userFixtures = await manager.find(User);
      expect(userFixtures).toStrictEqual([]);
    });

    it('If there is no transaction in progress, it must be executed without transaction', async () => {
      const service = app.get(UsingCallbackService);

      try {
        await service.createAndUpdateUserSupports(fixureUserId, () => {
          throw new RollbackError('Roll back!');
        });
      } catch (e) {
        if (!(e instanceof RollbackError)) throw e;
      }

      const manager = dataSource.createEntityManager();

      const userFixture = await manager.findOneBy(User, {
        id: fixureUserId,
      });
      expect(userFixture).toBeDefined();
    });
  });
});
