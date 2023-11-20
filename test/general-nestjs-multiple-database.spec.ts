import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { runInTransaction } from '../src';
import { AppModule, Log, LOG_DB_NAME, RollbackError, User } from './fixtures';
import { getCurrentTransactionId } from './util';

describe('Multiple Database @Transactional in Nest.js', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let dataSourceSub: DataSource;

  const fixureUserId = '27ff4cfc-7656-428c-8da4-918424925c38';
  const fixtureLogId = 'e46804dc-e048-45c8-8b30-08ee1d238aa3';

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
    //   source: () => app.get<EntityManager>(getEntityManagerToken()),
    // },
    {
      name: '@InjectDataSource',
      source: () => app.get(getDataSourceToken()).manager,
      source2: () => app.get(getDataSourceToken(LOG_DB_NAME)).manager,
    },
    {
      name: '@InjectRepository',
      source: () => app.get(getRepositoryToken(User)).manager,
      source2: () => app.get(getRepositoryToken(Log, LOG_DB_NAME)).manager,
    },
  ];

  describe.each(managerGetters)(
    'The following transaction requirements must be met when using $name.',
    ({ source, source2 }) => {
      it('When different context run in parallel and different database, they must operate in different transactions.', async () => {
        const manager = source();
        const manager2 = source2();

        let transactionA: number | null = null;
        let transactionB: number | null = null;
        let transactionC: number | null = null;

        await Promise.all([
          // DB 1
          runInTransaction(async () => {
            await manager.save(User.create());
            transactionA = await getCurrentTransactionId(manager);
          }),
          runInTransaction(async () => {
            await manager.save(User.create());
            transactionB = await getCurrentTransactionId(manager);
          }),

          // DB 2
          runInTransaction(
            async () => {
              await manager2.save(Log.create());
              transactionC = await getCurrentTransactionId(manager2);
            },
            {
              connectionName: LOG_DB_NAME,
            },
          ),
        ]);

        await Promise.all([transactionA, transactionB, transactionC]);

        expect(transactionA).toBeTruthy();
        expect(transactionB).toBeTruthy();
        expect(transactionC).toBeTruthy();

        expect(transactionA).not.toBe(transactionB);
        expect(transactionA).not.toBe(transactionC);
        expect(transactionB).not.toBe(transactionC);

        const users = await manager.find(User, {});
        expect(users.length).toBe(2);

        const logs = await manager2.find(Log, {});
        expect(logs.length).toBe(1);
      });

      it('If the contexts are nested and the nested databases are different, all subcontexts must participate in the top context of the same database.', async () => {
        const manager = source();
        const manager2 = source2();

        // DB 2
        await runInTransaction(
          async () => {
            const transactionIdDB_1_TOP = await getCurrentTransactionId(manager2);

            // DB 1
            await runInTransaction(async () => {
              const transactionIdDB_2_TOP = await getCurrentTransactionId(manager);

              // DB 2
              await runInTransaction(
                async () => {
                  await manager2.save(Log.create());

                  const transactionIdDB_1_SUB = await getCurrentTransactionId(manager2);

                  // DB 1
                  await runInTransaction(async () => {
                    await manager.save(User.create());
                    const transactionIdDB_2_SUB = await getCurrentTransactionId(manager);

                    expect(transactionIdDB_1_TOP).toBe(transactionIdDB_1_SUB);
                    expect(transactionIdDB_2_TOP).toBe(transactionIdDB_2_SUB);

                    expect(transactionIdDB_1_TOP).not.toBe(transactionIdDB_2_TOP);
                  });
                },
                {
                  connectionName: LOG_DB_NAME,
                },
              );
            });
          },
          {
            connectionName: LOG_DB_NAME,
          },
        );

        const users = await manager.find(User, {});
        expect(users.length).toBe(1);

        const logs = await manager2.find(Log, {});
        expect(logs.length).toBe(1);
      });

      it('If different database transactions nested and errors occur in the parent database transaction, only the parent database transaction should be rolled back.', async () => {
        const manager = source();
        const manager2 = source2();

        try {
          await runInTransaction(async () => {
            await source().save(User.create(fixureUserId));

            await runInTransaction(
              async () => {
                await source2().save(Log.create(fixtureLogId));
              },
              {
                connectionName: LOG_DB_NAME,
              },
            );

            throw new RollbackError();
          });
        } catch (e) {
          if (!(e instanceof RollbackError)) throw e;
        }

        const user = await manager.findOneBy(User, {
          id: fixureUserId,
        });
        expect(user).toBe(null);

        const log = await manager2.findOneBy(Log, {
          id: fixtureLogId,
        });
        expect(log).toBeDefined();
      });

      it('If different database transactions nested and errors occur in sub-database transactions, all transactions must be rolled back.', async () => {
        const manager = source();
        const manager2 = source2();

        try {
          await runInTransaction(async () => {
            await source().save(User.create(fixureUserId));

            await runInTransaction(
              async () => {
                await source2().save(Log.create(fixtureLogId));
                throw new RollbackError();
              },
              {
                connectionName: LOG_DB_NAME,
              },
            );
          });
        } catch (e) {
          if (!(e instanceof RollbackError)) throw e;
        }

        const user = await manager.findOneBy(User, {
          id: fixureUserId,
        });
        expect(user).toBe(null);

        const log = await manager2.findOneBy(Log, {
          id: fixtureLogId,
        });
        expect(log).toBe(null);
      });
    },
  );
});
