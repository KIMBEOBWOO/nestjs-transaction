import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { IsolationLevel, IsolationLevelType, runInTransaction } from '../src';
import { AppModule, RollbackError, User, UserService, UsingCallbackService } from './fixtures';
import * as common from '../src/common';
import { TEST_QUERY_RUNNER_TOKEN, TYPEORM_TRANSACTION_SERVICE_TOKEN } from '../src/symbols';
import { MockTransactionModule } from '../src/mocks';
import { Store, storage } from '../src/storage';
import { ExecutableTransaction, TransactionOptions } from '../src/interfaces';
import { TYPEORM_DEFAULT_DATA_SOURCE_NAME } from '../src/common';

describe('@Transactional UseCase in Nest.js', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let testQueryRunner: QueryRunner;

  const fixureUserId = '27ff4cfc-7656-428c-8da4-918424925c38';
  const fixureUserId2 = '95ce2449-adee-47bb-a068-29d4d3f1b721';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule, MockTransactionModule.forRoot()],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    dataSource = app.get<DataSource>(getDataSourceToken());
    testQueryRunner = app.get<QueryRunner>(TEST_QUERY_RUNNER_TOKEN);
  });

  afterAll(async () => {
    // await testQueryRunner.release();
    await dataSource.destroy();
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE public.user CASCADE');
    await testQueryRunner.startTransaction();
  });

  afterEach(async () => {
    await testQueryRunner.rollbackTransaction();
  });

  it('', async () => {
    // 각 storage 에 미리 엔터티 적용
    jest.spyOn(common, 'getDataSource').mockImplementation(() => {
      return {
        createQueryRunner: () => testQueryRunner,
      } as any;
    });

    const transactionService = app.get<ExecutableTransaction>(TYPEORM_TRANSACTION_SERVICE_TOKEN);

    jest
      .spyOn(transactionService, 'runInNewTransaction')
      .mockImplementation((runOriginal: () => any, options?: TransactionOptions) => {
        const dataSourceName = options?.connectionName || TYPEORM_DEFAULT_DATA_SOURCE_NAME;
        const isolationLevel: IsolationLevelType =
          options?.isolationLevel || IsolationLevel.READ_COMMITTED;

        const queryRunner = common.getDataSource(dataSourceName).createQueryRunner();

        const newStore: Store<QueryRunner> = {
          data: queryRunner,
        };

        return storage.run(dataSourceName, newStore, async () => {
          await queryRunner.startTransaction(isolationLevel);

          try {
            const result = await runOriginal();

            await queryRunner.commitTransaction();

            return result;
          } catch (e) {
            await queryRunner.rollbackTransaction();
            throw e;
          }
        });
      });

    const service = app.get(UserService);
    await service.createUser();
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
