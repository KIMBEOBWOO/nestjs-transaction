import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { IsolationLevel, Propagation, runInTransaction } from '../src';
import { TYPEORM_DEFAULT_DATA_SOURCE_NAME } from '../src/common';
import { storage } from '../src/storage';
import { AppModule, LOG_DB_NAME, RollbackError, User, UserImage } from './fixtures';
import { getCurrentTransactionId, sleep } from './util';

describe('Single Database @Transactional in Nest.js', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let dataSourceSub: DataSource;

  const fixureUserId = '27ff4cfc-7656-428c-8da4-918424925c38';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();

    await app.init();

    dataSource = module.get(getDataSourceToken());
    dataSourceSub = module.get(getDataSourceToken(LOG_DB_NAME));
  });

  afterAll(async () => {
    await dataSource.destroy();
    await dataSourceSub.destroy();
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE public.user RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE public.counters RESTART IDENTITY CASCADE');
    await dataSourceSub.query('TRUNCATE public.log RESTART IDENTITY CASCADE');
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
    //   // source: async () => await app.resolve<EntityManager>(getTransactionalEntityManagerToken()),
    //   source: () => app.get(getEntityManagerToken()),
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
          const target = await source();
          const storeManager = (
            storage.getContext(TYPEORM_DEFAULT_DATA_SOURCE_NAME)?.data as QueryRunner
          )?.manager;

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
          const manager = await source();

          const user = User.create({
            id: fixureUserId,
          });

          const userImage = new UserImage();

          await manager.save(User, {
            ...user,
            imageList: [userImage],
          });
        });

        const userFixture = await dataSource.manager.findOne(User, {
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
          const manager = await source();
          transactionIdA = await getCurrentTransactionId(dataSource);
          await manager.save(User.create());
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
          const manager = await source();
          transactionIdBefore = await getCurrentTransactionId(dataSource);
          await manager.save(User.create(userFixtureId));
          const transactionIdAfter = await getCurrentTransactionId(dataSource);

          expect(transactionIdBefore).toBeTruthy();
          expect(transactionIdBefore).toBe(transactionIdAfter);
        });

        const transactionIdOutside = await getCurrentTransactionId(dataSource);
        expect(transactionIdOutside).not.toBe(transactionIdBefore);

        const user = await dataSource.manager.findOneBy(User, {
          id: userFixtureId,
        });
        expect(user).toBeDefined();
      });

      it('Should rollback the transaction if an error is thrown', async () => {
        try {
          await runInTransaction(async () => {
            const manager = await source();
            await manager.save(User.create(userFixtureId));
            throw new RollbackError();
          });
        } catch (e) {
          if (!(e instanceof RollbackError)) throw e;
        }

        const user = await dataSource.manager.findOneBy(User, {
          id: userFixtureId,
        });
        expect(user).toBe(null);
      });

      it('If the context is nested, all subcontexts must participate in the transaction in which the top-level context is in progress.', async () => {
        await runInTransaction(async () => {
          const manager = await source();
          const transactionIdBefore = await getCurrentTransactionId(dataSource);

          await runInTransaction(async () => {
            const transactionIdAfter = await getCurrentTransactionId(dataSource);

            await manager.save(User.create(userFixtureId));
            expect(transactionIdBefore).toBe(transactionIdAfter);

            await runInTransaction(async () => {
              const transactionIdAfter = await getCurrentTransactionId(dataSource);

              await manager.save(User.create(userFixtureId));
              expect(transactionIdBefore).toBe(transactionIdAfter);
            });
          });
        });

        expect.assertions(3);
        const user = await dataSource.manager.findOneBy(User, {
          id: userFixtureId,
        });
        expect(user).toBeDefined();
      });

      it('When different contacts run in parallel, they must operate in different transactions.', async () => {
        let transactionA: number | null = null;
        let transactionB: number | null = null;
        let transactionC: number | null = null;

        await Promise.all([
          runInTransaction(async () => {
            const manager = await source();
            await manager.save(User.create());
            transactionA = await getCurrentTransactionId(dataSource);
          }),
          runInTransaction(async () => {
            const manager = await source();
            await manager.save(User.create());
            transactionB = await getCurrentTransactionId(dataSource);
          }),
          runInTransaction(async () => {
            const manager = await source();
            await manager.save(User.create());
            transactionC = await getCurrentTransactionId(dataSource);
          }),
        ]);

        await Promise.all([transactionA, transactionB, transactionC]);

        expect(transactionA).toBeTruthy();
        expect(transactionB).toBeTruthy();
        expect(transactionC).toBeTruthy();

        expect(transactionA).not.toBe(transactionB);
        expect(transactionA).not.toBe(transactionC);
        expect(transactionB).not.toBe(transactionC);

        const users = await dataSource.manager.find(User, {});
        expect(users.length).toBe(3);
      });

      it("doesn't leak variables to outer scope", async () => {
        let transactionSetup = false;
        let transactionEnded = false;

        let transactionIdOutside: number | null = null;

        const transaction = runInTransaction(async () => {
          transactionSetup = true;

          await sleep(500);

          const transactionIdInside = await getCurrentTransactionId(dataSource);

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
        transactionIdOutside = await getCurrentTransactionId(dataSource);
        expect(transactionIdOutside).toBe(null);

        expect(transactionEnded).toBe(false);

        await transaction;
      });

      describe('Isolation', () => {
        it('should read the most recent committed rows when using READ COMMITTED isolation level', async () => {
          await runInTransaction(
            async () => {
              const manager = await source();
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
          await runInTransaction(
            async () => {
              const manager = await source();
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

      describe('Propagation', () => {
        it('should support "REQUIRED" propagation', async () => {
          const manager: EntityManager = source();

          await runInTransaction(async () => {
            const transactionId = await getCurrentTransactionId(manager);
            await manager.save(User.create(userFixtureId));

            await runInTransaction(
              async () => {
                await manager.save(User.create());
                const transactionIdNested = await getCurrentTransactionId(manager);

                // We expect the nested transaction to be under the same transaction
                expect(transactionId).toBe(transactionIdNested);
              },
              { propagation: Propagation.REQUIRED },
            );
          });
        });

        it('should support "SUPPORTS" propagation if active transaction exists', async () => {
          const manager: EntityManager = source();

          await runInTransaction(async () => {
            const transactionId = await getCurrentTransactionId(manager);
            await manager.save(User.create());

            await runInTransaction(
              async () => {
                await manager.save(User.create());
                const transactionIdNested = await getCurrentTransactionId(manager);

                // We expect the nested transaction to be under the same transaction
                expect(transactionId).toBe(transactionIdNested);
              },
              { propagation: Propagation.SUPPORTS },
            );
          });
        });

        it('should support "SUPPORTS" propagation if active transaction doesn\'t exist', async () => {
          const manager: EntityManager = source();

          await runInTransaction(
            async () => {
              const transactionId = await getCurrentTransactionId(manager);

              // We expect the code to be executed without a transaction
              expect(transactionId).toBe(null);
            },
            { propagation: Propagation.SUPPORTS },
          );
        });
      });
    },
  );
});
