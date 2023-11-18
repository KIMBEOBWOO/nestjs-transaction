import { DataSource } from 'typeorm';
import { addTransactionalDataSource, runInTransaction } from '../src';
import { Counter, mainDataSourceOpiton, RollbackError, User } from './fixtures';
import { getCurrentTransactionId, sleep } from './util';

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

  /**
   * Transaction Aspect is applicable when using the following sources
   */
  const sources = [
    {
      name: 'DataSource, @InjectDataSource',
      source: dataSource,
    },
    {
      name: 'Repository, @InjectRepository',
      source: dataSource.getRepository(User),
    },
    {
      name: 'Entity Manager, @InjectEntityManager',
      source: dataSource.createEntityManager(),
    },
    {
      name: 'Repository Manager, repository.manager',
      source: dataSource.getRepository(User).manager,
    },
    {
      name: 'Query Builder, dataSource.createQueryBuilder',
      source: () => dataSource.createQueryBuilder(),
    },
  ];

  describe.each(sources)('$name', ({ source }) => {
    it('If executed in the same context, the query must be executed within the same transaction.', async () => {
      let transactionIdBefore: number | null = null;

      await runInTransaction(async () => {
        transactionIdBefore = await getCurrentTransactionId(source);
        const transactionIdAfter = await getCurrentTransactionId(source);

        expect(transactionIdBefore).toBeTruthy();
        expect(transactionIdBefore).toBe(transactionIdAfter);
      });

      const transactionIdOutside = await getCurrentTransactionId(source);
      expect(transactionIdOutside).toBe(null);
    });

    it('If the context is nested, all subcontexts must participate in the transaction in which the top-level context is in progress.', async () => {
      await runInTransaction(async () => {
        const transactionIdTop = await getCurrentTransactionId(source);

        await runInTransaction(async () => {
          const transactionIdMiddle = await getCurrentTransactionId(source);
          expect(transactionIdTop).toBe(transactionIdMiddle);

          await runInTransaction(async () => {
            const transactionIdBottom = await getCurrentTransactionId(source);
            expect(transactionIdMiddle).toBe(transactionIdBottom);
          });
        });
      });

      expect.assertions(2);
    });

    it('When different contacts run in parallel, they must operate in different transactions.', async () => {
      let transactionA: number | null = null;
      let transactionB: number | null = null;
      let transactionC: number | null = null;

      await Promise.all([
        runInTransaction(async () => {
          transactionA = await getCurrentTransactionId(source);
        }),
        runInTransaction(async () => {
          transactionB = await getCurrentTransactionId(source);
        }),
        runInTransaction(async () => {
          transactionC = await getCurrentTransactionId(source);
        }),
      ]);

      await Promise.all([transactionA, transactionB, transactionC]);

      expect(transactionA).toBeTruthy();
      expect(transactionB).toBeTruthy();
      expect(transactionC).toBeTruthy();

      expect(transactionA).not.toBe(transactionB);
      expect(transactionA).not.toBe(transactionC);
      expect(transactionB).not.toBe(transactionC);
    });
  });

  // Focus more on the repository, since it's the most common use case
  describe('Repository', () => {
    const userFixtureId = '75fb75f6-8421-4a4e-991b-7762e8b63a4c';

    // We want to check that `save` doesn't create any intermediate transactions
    it('Should not create any intermediate transactions', async () => {
      let transactionIdA: number | null = null;
      let transactionIdB: number | null = null;

      const userRepository = dataSource.getRepository(User);

      await runInTransaction(async () => {
        transactionIdA = await getCurrentTransactionId(dataSource);
        await userRepository.save(User.create());
      });

      await runInTransaction(async () => {
        transactionIdB = await getCurrentTransactionId(dataSource);
      });

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const transactionDiff = transactionIdB! - transactionIdA!;
      expect(transactionDiff).toBe(1);
    });

    it('If executed in the same context, the query must be executed within the same transaction.', async () => {
      const userRepository = dataSource.getRepository(User);

      let transactionIdBefore: number | null = null;
      await runInTransaction(async () => {
        transactionIdBefore = await getCurrentTransactionId(userRepository);
        await userRepository.save(User.create(userFixtureId));
        const transactionIdAfter = await getCurrentTransactionId(userRepository);

        expect(transactionIdBefore).toBeTruthy();
        expect(transactionIdBefore).toBe(transactionIdAfter);
      });

      const transactionIdOutside = await getCurrentTransactionId(userRepository);
      expect(transactionIdOutside).not.toBe(transactionIdBefore);

      const user = await userRepository.findOneBy({
        id: userFixtureId,
      });
      expect(user).toBeDefined();
    });

    it('Should rollback the transaction if an error is thrown', async () => {
      const userRepository = dataSource.getRepository(User);

      try {
        await runInTransaction(async () => {
          await userRepository.save(User.create(userFixtureId));
          throw new RollbackError();
        });
      } catch (e) {
        if (!(e instanceof RollbackError)) throw e;
      }

      const user = await userRepository.findOneBy({
        id: userFixtureId,
      });
      expect(user).toBe(null);
    });

    it('If the context is nested, all subcontexts must participate in the transaction in which the top-level context is in progress.', async () => {
      const userRepository = dataSource.getRepository(User);

      await runInTransaction(async () => {
        const transactionIdBefore = await getCurrentTransactionId(userRepository);

        await runInTransaction(async () => {
          const transactionIdAfter = await getCurrentTransactionId(userRepository);

          await userRepository.save(User.create(userFixtureId));
          expect(transactionIdBefore).toBe(transactionIdAfter);
        });
      });

      expect.assertions(2);
      const user = await userRepository.findOneBy({
        id: userFixtureId,
      });
      expect(user).toBeDefined();
    });

    it('When different contacts run in parallel, they must operate in different transactions.', async () => {
      const userRepository = dataSource.getRepository(User);

      let transactionA: number | null = null;
      let transactionB: number | null = null;
      let transactionC: number | null = null;

      await Promise.all([
        runInTransaction(async () => {
          await userRepository.save(User.create());
          transactionA = await getCurrentTransactionId(userRepository);
        }),
        runInTransaction(async () => {
          await userRepository.save(User.create());
          transactionB = await getCurrentTransactionId(userRepository);
        }),
        runInTransaction(async () => {
          await userRepository.save(User.create());
          transactionC = await getCurrentTransactionId(userRepository);
        }),
      ]);

      await Promise.all([transactionA, transactionB, transactionC]);

      expect(transactionA).toBeTruthy();
      expect(transactionB).toBeTruthy();
      expect(transactionC).toBeTruthy();

      expect(transactionA).not.toBe(transactionB);
      expect(transactionA).not.toBe(transactionC);
      expect(transactionB).not.toBe(transactionC);

      const users = await userRepository.find();
      expect(users.length).toBe(3);
    });

    it("doesn't leak variables to outer scope", async () => {
      let transactionSetup = false;
      let transactionEnded = false;

      const userRepository = dataSource.getRepository(User);

      let transactionIdOutside: number | null = null;

      const transaction = runInTransaction(async () => {
        transactionSetup = true;

        await sleep(500);

        const transactionIdInside = await getCurrentTransactionId(userRepository);

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
      transactionIdOutside = await getCurrentTransactionId(userRepository);
      expect(transactionIdOutside).toBe(null);

      expect(transactionEnded).toBe(false);

      await transaction;
    });
  });
});
