import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Propagation, runInTransaction, TestTransactionModule } from '../src';
import { AppModule, CustomTransactionProvider, RollbackError, UserService } from './fixtures';

describe('@Transactional UseCase in Nest.js', () => {
  let app: INestApplication;
  let dataSource: DataSource;

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

  describe('', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const propagationList = [
      {
        case: Propagation.REQUIRED,
        expectedCommitHookCalls: 1,
        expectedRollBackHookCalls: 1,
      },
      {
        case: Propagation.SUPPORTS,
        expectedCommitHookCalls: 1,
        expectedRollBackHookCalls: 0,
      },
    ];

    describe.each(propagationList)('', ({ case: propagation, expectedCommitHookCalls }) => {
      it('onCommit hook is called only when the transaction is committed.', async () => {
        const service = app.get(UserService);
        const customTransactionProvider = new CustomTransactionProvider(service);
        const onCommit = jest.spyOn(customTransactionProvider, 'onCommit');

        await runInTransaction(
          async () => {
            await service.createUser();
          },
          { propagation },
          customTransactionProvider,
        );

        expect(onCommit).toBeCalledTimes(expectedCommitHookCalls);
      });
    });

    describe.each(propagationList)('', ({ case: propagation, expectedRollBackHookCalls }) => {
      it('onRollBack hook is called only when the transaction is rolled back.', async () => {
        const service = app.get(UserService);
        const customTransactionProvider = new CustomTransactionProvider(service);
        const onRollBack = jest.spyOn(customTransactionProvider, 'onRollBack');

        try {
          await runInTransaction(
            async () => {
              await service.createUser();
              throw new RollbackError('Roll back!');
            },
            { propagation },
            customTransactionProvider,
          );
        } catch (e) {
          if (!(e instanceof RollbackError)) throw e;
        }

        expect(onRollBack).toBeCalledTimes(expectedRollBackHookCalls);
      });
    });
  });
});
