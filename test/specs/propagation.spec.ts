import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { runInTransaction, Propagation } from '../../src';
import { AppModule, LOG_DB_NAME, User, RollbackError } from '../fixtures';
import { getCurrentTransactionId } from '../utils';

describe('Propagtion', () => {
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
    {
      name: '@InjectDataSource',
      source: () => dataSource.manager,
    },
    {
      name: '@InjectRepository',
      source: () => app.get(getRepositoryToken(User)).manager,
    },
  ];

  describe.each(managerGetters)(
    'The following transaction requirements must be met when using $name.',
    ({ source }) => {
      const userFixtureId = '75fb75f6-8421-4a4e-991b-7762e8b63a4c';

      describe('REQUIRED', () => {
        it('If there is an ongoing transaction, you must participate in it.', async () => {
          await runInTransaction(
            async () => {
              const manager: EntityManager = source();
              const transactionId = await getCurrentTransactionId(manager);
              await manager.save(User.create(userFixtureId));

              await runInTransaction(
                async () => {
                  const manager: EntityManager = source();
                  await manager.save(User.create());
                  const transactionIdNested = await getCurrentTransactionId(manager);

                  // We expect the nested transaction to be under the same transaction
                  expect(transactionId).toBe(transactionIdNested);
                },
                { propagation: Propagation.REQUIRED },
              );
            },
            { propagation: Propagation.REQUIRED },
          );

          const users = await source().find(User);
          expect(users.length).toBe(2);
        });

        it('If there is no ongoing transaction, a new transaction must be created.', async () => {
          await runInTransaction(
            async () => {
              const manager: EntityManager = source();
              const transactionId = await getCurrentTransactionId(manager);

              // We expect the code to be executed with a transaction
              expect(transactionId).toBeTruthy();
            },
            { propagation: Propagation.REQUIRED },
          );
        });
      });

      describe('SUPPORTS', () => {
        it('If there is an ongoing transaction, you must participate in it.', async () => {
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

        it('If there is no transaction in progress, the query should be executed without a transaction.', async () => {
          try {
            await runInTransaction(
              async () => {
                const manager: EntityManager = source();
                const transactionId = await getCurrentTransactionId(manager);

                // We expect the code to be executed without a transaction
                expect(transactionId).toBe(null);

                throw new RollbackError();
              },
              { propagation: Propagation.SUPPORTS },
            );
          } catch (e) {
            if (!(e instanceof RollbackError)) throw e;
          }

          const user = await source().findOneBy(User, { id: fixureUserId });
          expect(user).toBeDefined(); // should not be rollback
        });
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

        it.each(
          Object.values(Propagation).map((propagation) => ({
            case: propagation,
          })),
        )(
          'If an error occurs in a nested transaction, the parent $case transaction should not be rolled back.',
          async ({ case: propagation }) => {
            try {
              // parent active transaction
              await runInTransaction(
                async () => {
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
                },
                {
                  propagation: propagation,
                },
              );
            } catch (e) {
              if (!(e instanceof RollbackError)) throw e;
            }

            const manager: EntityManager = source();
            const user = await manager.findOneByOrFail(User, { id: fixureUserId });
            expect(user).toBeDefined();
          },
        );

        it('If an error occurs in a higher dataSourceNametransaction, it should be rolled back together.', async () => {
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

      describe('REQUIRES_NEW', () => {
        it('If there is no parent transaction, a new transaction must be created.', async () => {
          // active parent transaction
          await runInTransaction(async () => {
            const manager: EntityManager = source();
            await manager.save(User.create());

            const transactionId = await getCurrentTransactionId(manager);
            expect(transactionId).toBeTruthy();
          });

          const users = await source().find(User);
          expect(users.length).toBe(1);
        });

        it('If there is a transaction in progress, must create new transaction', async () => {
          // active parent transaction
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
                expect(transactionId).not.toBe(transactionIdNested); // should be same transaction
              },
              { propagation: Propagation.REQUIRES_NEW },
            );
          });

          const users = await source().find(User);
          expect(users.length).toBe(2);
        });

        it('If an error occurs in a higher transaction, it should not be rolled back together.', async () => {
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
                { propagation: Propagation.REQUIRES_NEW },
              );

              // Higher transaction error
              throw new RollbackError('Origin');
            });
          } catch (e) {
            if (!(e instanceof RollbackError)) throw e;
          }

          const user = await source().findOneBy(User, { id: fixureUserId2 });
          expect(user).toBeDefined();
        });

        describe.each(
          Object.values(Propagation).map((propagation) => ({
            case: propagation,
          })),
        )('$case', ({ case: propagation }) => {
          it('If an error occurs in a nested transaction, the parent transaction should not be rolled back.', async () => {
            try {
              // parent active transaction
              await runInTransaction(
                async () => {
                  const manager: EntityManager = source();
                  await manager.save(User.create(fixureUserId));

                  // child nested transaction
                  await runInTransaction(
                    async () => {
                      const manager: EntityManager = source();
                      await manager.save(User.create());

                      throw new RollbackError('Origin');
                    },
                    { propagation: Propagation.REQUIRES_NEW },
                  );
                },
                {
                  propagation: propagation,
                },
              );
            } catch (e) {
              if (!(e instanceof RollbackError)) throw e;
            }

            const manager: EntityManager = source();
            const user = await manager.findOneByOrFail(User, { id: fixureUserId });
            expect(user).toBeDefined();
          }, 10000);
        });
      });
    },
  );
});
