import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import {
  IsolationLevel,
  Propagation,
  runInTransaction,
  runOnTransactionCommit,
  runOnTransactionRollback,
} from '../../src';
import { TYPEORM_DEFAULT_DATA_SOURCE_NAME } from '../../src/common';
import { storage } from '../../src/storage';
import { AppModule, LOG_DB_NAME, RollbackError, User, UserImage } from '../fixtures';
import { getCurrentTransactionId, sleep } from '../utils';

/**
 * Test cases for Nest.js in single database mode
 * Most of the test cases are the same as the test cases for Forked library [typeorm-transactional](https://github.com/Aliheym/typeorm-transactional)
 */
describe('Single Database @Transactional in Nest.js', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let dataSourceSub: DataSource;

  const fixureUserId = '27ff4cfc-7656-428c-8da4-918424925c38';
  const fixureUserId2 = '288cb576-8248-48f3-9e20-90f8596c02b1';

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
     * @NOTE [Issue#4](https://github.com/KIMBEOBWOO/nestjs-transaction/issues/4)
     */
    // {
    //   name: '@InjectEntityManager',
    //   // source: async () => await app.resolve<EntityManager>(getTransactionalEntityManagerToken()),
    //   source: () => app.get(getEntityManagerToken()),
    // },
    // {
    //   name: '@InjectDataSource',
    //   source: () => dataSource.manager,
    // },
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
          const storeManager = storage.get<QueryRunner>(TYPEORM_DEFAULT_DATA_SOURCE_NAME)?.manager;

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
          const manager = source();

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

      beforeEach(() => {
        jest.restoreAllMocks();
      });

      // We want to check that `save` doesn't create any intermediate transactions
      it('Should not create any intermediate transactions', async () => {
        let transactionIdA: number | null = null;
        let transactionIdB: number | null = null;

        await runInTransaction(async () => {
          const manager = source();
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
          const manager = source();
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
            const manager = source();
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
          const manager = source();
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
            const manager = source();
            await manager.save(User.create());
            transactionA = await getCurrentTransactionId(dataSource);
          }),
          runInTransaction(async () => {
            const manager = source();
            await manager.save(User.create());
            transactionB = await getCurrentTransactionId(dataSource);
          }),
          runInTransaction(async () => {
            const manager = source();
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
              const manager = source();
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
              const manager = source();
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

        describe('NESTED', () => {
          it('If there is a transaction in progress, you must participate in the transaction and save the save point.', async () => {
            // parent active transaction
            await runInTransaction(async () => {
              const manager: EntityManager = source();
              await manager.save(User.create());
              const transactionId = await getCurrentTransactionId(manager);

              // child nested transaction
              await runInTransaction(
                async () => {
                  const manager: EntityManager = source();

                  await manager.save(User.create());
                  const transactionIdNested = await getCurrentTransactionId(manager);

                  expect(transactionId).toBeTruthy();
                  expect(transactionIdNested).toBeTruthy();
                  expect(transactionId).toBe(transactionIdNested); // should be same transaction
                },
                { propagation: Propagation.NESTED },
              );
            });

            const users = await source().find(User);
            expect(users.length).toBe(2);
          });

          it('If an error occurs in a nested transaction, the parent transaction should not be rolled back.', async () => {
            try {
              // parent active transaction
              await runInTransaction(async () => {
                const manager: EntityManager = source();
                await manager.save(User.create(fixureUserId));

                // child nested transaction
                await runInTransaction(
                  async () => {
                    const manager: EntityManager = source();
                    await manager.save(User.create());

                    throw new RollbackError('Origin');
                  },
                  { propagation: Propagation.NESTED },
                );
              });
            } catch (e) {
              if (!(e instanceof RollbackError)) throw e;
            }

            const manager: EntityManager = source();
            const user = await manager.findOneByOrFail(User, { id: fixureUserId });
            expect(user).toBeDefined();
          });

          it('If an error occurs in a higher transaction, it should be rolled back together.', async () => {
            try {
              // parent active transaction
              await runInTransaction(async () => {
                const manager: EntityManager = source();
                await manager.save(User.create(fixureUserId));

                // child nested transaction
                await runInTransaction(
                  async () => {
                    const manager: EntityManager = source();
                    await manager.save(User.create(fixureUserId2));
                  },
                  { propagation: Propagation.NESTED },
                );

                // Higher transaction error
                throw new RollbackError('Origin');
              });
            } catch (e) {
              if (!(e instanceof RollbackError)) throw e;
            }

            const users = await source().find(User);
            expect(users.length).toBe(0);
          });

          it("Create new transaction if active transaction doesn't exist", async () => {
            const manager: EntityManager = source();

            await runInTransaction(
              async () => {
                const transactionId = await getCurrentTransactionId(manager);

                // We expect the code to be executed with a transaction
                expect(transactionId).toBeTruthy();
              },
              { propagation: Propagation.NESTED },
            );
          });
        });
      });

      describe('Hooks', () => {
        it('If transaction is successful, only onCommit hook should be called', async () => {
          const onCommitFn = jest.fn().mockResolvedValue(true);
          const onRollbackFn = jest.fn();

          await runInTransaction(async () => {
            runOnTransactionCommit(async () => {
              await onCommitFn();
            });

            runOnTransactionRollback(() => {
              onRollbackFn();
            });
          });

          expect(onCommitFn).toBeCalledTimes(1);
          expect(onRollbackFn).toBeCalledTimes(0);
        });

        it('If transaction is rolled back, only onRollback hook should be called', async () => {
          const onCommitFn = jest.fn();
          const onRollbackFn = jest.fn();

          try {
            await runInTransaction(async () => {
              runOnTransactionCommit(async () => {
                onCommitFn();
              });

              runOnTransactionRollback(async () => {
                onRollbackFn();
              });
              throw new RollbackError();
            });
          } catch (e) {
            if (!(e instanceof RollbackError)) throw e;
          }

          expect(onCommitFn).toBeCalledTimes(0);
          expect(onRollbackFn).toBeCalledTimes(1);
        });

        it('If nested transaction is executed, onCommit hook should be called after all nested transactions are executed and committed', async () => {
          const onCommitFn = jest.fn().mockReturnValue(true);

          await runInTransaction(async () => {
            runOnTransactionCommit(() => onCommitFn());

            expect(onCommitFn).toBeCalledTimes(0); // onCommitFn should not be called yet

            await runInTransaction(async () => {
              runOnTransactionCommit(() => onCommitFn());
            });

            expect(onCommitFn).toBeCalledTimes(0); // onCommitFn should not be called yet
          });

          expect(onCommitFn).toBeCalledTimes(2);
        });

        it('If nested transaction is executed, onRollback hook should be called after throw an error in nested transaction and rollback', async () => {
          const onRollbackFn = jest.fn().mockReturnValue(true);

          try {
            await runInTransaction(async () => {
              runOnTransactionRollback(() => onRollbackFn());
              expect(onRollbackFn).toBeCalledTimes(0); // onRollbackFn should not be called yet

              await runInTransaction(async () => {
                runOnTransactionRollback(() => onRollbackFn());
              });
              expect(onRollbackFn).toBeCalledTimes(0); // onRollbackFn should not be called yet

              throw new RollbackError();
            });
          } catch (e) {
            if (!(e instanceof RollbackError)) throw e;
          }

          expect(onRollbackFn).toBeCalledTimes(2);
        });
      });
    },
  );
});
