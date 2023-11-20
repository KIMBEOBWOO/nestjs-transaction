import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { IsolationLevel, runInTransaction } from '../src';
import { storage } from '../src/storage';
import { AppModule, RollbackError, User, UserImage } from './fixtures';
import { getCurrentTransactionId, sleep } from './util';

describe('@Transactional in Nest.js', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const fixureUserId = '27ff4cfc-7656-428c-8da4-918424925c38';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    dataSource = module.get(getDataSourceToken());
    app.init();
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE public.user CASCADE');
    await dataSource.query('TRUNCATE public.counters CASCADE');
  });

  /**
   * Transaction Aspect is applicable when using the following sources
   */
  const managerGetters = [
    /**
     * @NOTE not working
     */
    // {
    //   name: '@InjectEntityManager',
    //   source: () => app.get<EntityManager>(getEntityManagerToken()),
    // },
    {
      name: '@InjectDataSource',
      source: () => app.get(getDataSourceToken()).manager,
    },
    {
      name: '@InjectRepository',
      source: () => app.get(getRepositoryToken(User)).manager,
    },
  ];

  const newManagerGetter = [
    {
      name: 'queryRunner.manager',
      source: () => {
        const queryRunner = app.get<DataSource>(getDataSourceToken()).createQueryRunner();
        return queryRunner.manager;
      },
    },
  ];

  describe('Validate that the injected resources import database interactions from storage within the transaction', () => {
    it.each(managerGetters)(
      'Injected providers $name must be return storage queryRunner',
      async ({ source }) => {
        await runInTransaction(async () => {
          const target = source();
          const storeManager = (storage.getStore()?.data as QueryRunner)?.manager;

          expect(target).toBeTruthy();
          expect(storeManager).toBeTruthy();
          expect(target === storeManager).toBe(true);
        });
      },
    );

    it.each([...managerGetters, ...newManagerGetter])(
      'if use $name Save CASCADE should be works',
      async ({ source }) => {
        await runInTransaction(async () => {
          const user = User.create({
            id: fixureUserId,
          });

          const userImage = new UserImage();

          await source().save(User, {
            ...user,
            imageList: [userImage],
          });
        });

        const manager = dataSource.createEntityManager();
        const userFixture = await manager.findOne(User, {
          where: {
            id: fixureUserId,
          },
          relations: {
            imageList: true,
          },
        });

        expect(userFixture).toBeDefined();
        expect(userFixture?.imageList?.[0]?.id).toBeTruthy();
      },
    );
  });

  describe.each(managerGetters)(
    'The following transaction requirements must be met when using $name.',
    ({ source }) => {
      const userFixtureId = '75fb75f6-8421-4a4e-991b-7762e8b63a4c';

      // We want to check that `save` doesn't create any intermediate transactions
      it('Should not create any intermediate transactions', async () => {
        let transactionIdA: number | null = null;
        let transactionIdB: number | null = null;

        await runInTransaction(async () => {
          transactionIdA = await getCurrentTransactionId(dataSource);
          await source().save(User.create());
        });

        await runInTransaction(async () => {
          transactionIdB = await getCurrentTransactionId(dataSource);
        });

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const transactionDiff = transactionIdB! - transactionIdA!;
        expect(transactionDiff).toBe(1);
      });

      it('If executed in the same context, the query must be executed within the same transaction.', async () => {
        let transactionIdBefore: number | null = null;
        await runInTransaction(async () => {
          transactionIdBefore = await getCurrentTransactionId(source());
          await source().save(User.create(userFixtureId));
          const transactionIdAfter = await getCurrentTransactionId(source());

          expect(transactionIdBefore).toBeTruthy();
          expect(transactionIdBefore).toBe(transactionIdAfter);
        });

        const transactionIdOutside = await getCurrentTransactionId(source());
        expect(transactionIdOutside).not.toBe(transactionIdBefore);

        const user = await source().findOneBy(User, {
          id: userFixtureId,
        });
        expect(user).toBeDefined();
      });

      it('Should rollback the transaction if an error is thrown', async () => {
        try {
          await runInTransaction(async () => {
            await source().save(User.create(userFixtureId));
            throw new RollbackError();
          });
        } catch (e) {
          if (!(e instanceof RollbackError)) throw e;
        }

        const user = await source().findOneBy(User, {
          id: userFixtureId,
        });
        expect(user).toBe(null);
      });

      it('If the context is nested, all subcontexts must participate in the transaction in which the top-level context is in progress.', async () => {
        const manager = source();

        await runInTransaction(async () => {
          const transactionIdBefore = await getCurrentTransactionId(manager);

          await runInTransaction(async () => {
            const transactionIdAfter = await getCurrentTransactionId(manager);

            await manager.save(User.create(userFixtureId));
            expect(transactionIdBefore).toBe(transactionIdAfter);
          });
        });

        expect.assertions(2);
        const user = await manager.findOneBy(User, {
          id: userFixtureId,
        });
        expect(user).toBeDefined();
      });

      it('When different contacts run in parallel, they must operate in different transactions.', async () => {
        const manager = source();

        let transactionA: number | null = null;
        let transactionB: number | null = null;
        let transactionC: number | null = null;

        await Promise.all([
          runInTransaction(async () => {
            await manager.save(User.create());
            transactionA = await getCurrentTransactionId(manager);
          }),
          runInTransaction(async () => {
            await manager.save(User.create());
            transactionB = await getCurrentTransactionId(manager);
          }),
          runInTransaction(async () => {
            await manager.save(User.create());
            transactionC = await getCurrentTransactionId(manager);
          }),
        ]);

        await Promise.all([transactionA, transactionB, transactionC]);

        expect(transactionA).toBeTruthy();
        expect(transactionB).toBeTruthy();
        expect(transactionC).toBeTruthy();

        expect(transactionA).not.toBe(transactionB);
        expect(transactionA).not.toBe(transactionC);
        expect(transactionB).not.toBe(transactionC);

        const users = await manager.find(User, {});
        expect(users.length).toBe(3);
      });

      it("doesn't leak variables to outer scope", async () => {
        let transactionSetup = false;
        let transactionEnded = false;

        const manager = source();

        let transactionIdOutside: number | null = null;

        const transaction = runInTransaction(async () => {
          transactionSetup = true;

          await sleep(500);

          const transactionIdInside = await getCurrentTransactionId(manager);

          expect(transactionIdInside).toBeTruthy();
          expect(transactionIdOutside).toBe(null);
          expect(transactionIdInside).not.toBe(transactionIdOutside);

          transactionEnded = true;
        });

        await new Promise<void>((resolve) => {
          const interval = setInterval(() => {
            if (transactionSetup) {
              clearInterval(interval);

              resolve();
            }
          }, 200);
        });

        expect(transactionEnded).toBe(false);
        transactionIdOutside = await getCurrentTransactionId(manager);
        expect(transactionIdOutside).toBe(null);

        expect(transactionEnded).toBe(false);

        await transaction;
      });

      describe('Isolation', () => {
        it('should read the most recent committed rows when using READ COMMITTED isolation level', async () => {
          const manager = source();

          await runInTransaction(
            async () => {
              const totalUsers = await manager.count(User);
              expect(totalUsers).toBe(0);

              await dataSource.transaction(async (manager) => {
                await manager.save(User.create(userFixtureId));
              });

              const totalUsers2 = await manager.count(User);
              expect(totalUsers2).toBe(1);
            },
            { isolationLevel: IsolationLevel.READ_COMMITTED },
          );
        });

        it("shouldn't see the most recent committed rows when using REPEATABLE READ isolation level", async () => {
          const manager = source();

          await runInTransaction(
            async () => {
              const notExistUser = await manager.findOneBy(User, {
                id: userFixtureId,
              });
              expect(notExistUser).toBe(null);

              await dataSource.transaction(async (manager) => {
                await manager.save(User.create(userFixtureId));
              });

              const stillNotExistUser = await manager.findOneBy(User, {
                id: userFixtureId,
              });
              expect(stillNotExistUser).toBe(null);
            },
            { isolationLevel: IsolationLevel.REPEATABLE_READ },
          );
        });
      });
    },
  );
});
