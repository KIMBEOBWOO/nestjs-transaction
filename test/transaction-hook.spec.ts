import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Propagation, TestTransactionModule } from '../src';
import { AppModule, CustomTransactionProvider, RollbackError, UsingHookService } from './fixtures';

describe('@Transactional hooks UseCase', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const fixureUserId = '27ff4cfc-7656-428c-8da4-918424925c38';

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

  describe('Nestjs Test', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const propagationList = [
      {
        case: Propagation.REQUIRED,
        expectedCommitHookCalls: 1,
        expectedRollBackHookCalls: 1,
        provider: CustomTransactionProvider,
      },
      {
        case: Propagation.SUPPORTS,
        expectedCommitHookCalls: 1,
        expectedRollBackHookCalls: 0,
        provider: 'CustomTransactionProvider2',
      },
    ];

    describe.each(propagationList)(
      '$case',
      ({ case: propagation, expectedCommitHookCalls, provider }) => {
        it('onCommit hook is called only when the transaction is committed.', async () => {
          const service = app.get(UsingHookService);
          const customTransactionProvider = app.get(provider);

          const onCommit = jest.spyOn(customTransactionProvider, 'onCommit');
          const onRollBack = jest.spyOn(customTransactionProvider, 'onRollBack');

          const targetMethodParams: Parameters<typeof service.createUserRequired> = [fixureUserId];

          if ((propagation as any) === Propagation.REQUIRED) {
            await service.createUserRequired(...targetMethodParams);
          } else {
            await service.createUserSupports(...targetMethodParams);
          }

          expect(onCommit).toBeCalledTimes(expectedCommitHookCalls);
          expectedCommitHookCalls && expect(onCommit).toBeCalledWith(...targetMethodParams);
          expect(onRollBack).toBeCalledTimes(0);
        });
      },
    );

    describe.each(propagationList)(
      '$case',
      ({ case: propagation, expectedRollBackHookCalls, provider }) => {
        it('onRollBack hook is called only when the transaction is rolled back.', async () => {
          const service = app.get(UsingHookService);
          const customTransactionProvider = app.get(provider);

          const onCommit = jest.spyOn(customTransactionProvider, 'onCommit');
          const onRollBack = jest.spyOn(customTransactionProvider, 'onRollBack');

          const throwErrorCallBack = () => {
            throw new RollbackError('Roll back!');
          };

          const targetMethodParams: Parameters<typeof service.createUserRequired> = [
            fixureUserId,
            throwErrorCallBack,
          ];

          try {
            if ((propagation as any) === Propagation.REQUIRED) {
              await service.createUserRequired(...targetMethodParams);
            } else {
              await service.createUserSupports(...targetMethodParams);
            }
          } catch (e) {
            if (!(e instanceof RollbackError)) throw e;
          }

          expect(onCommit).toBeCalledTimes(0);
          expectedRollBackHookCalls && expect(onRollBack).toBeCalledWith(...targetMethodParams);
          expect(onRollBack).toBeCalledTimes(expectedRollBackHookCalls);
        });
      },
    );
  });
});
