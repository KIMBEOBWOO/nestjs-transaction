import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Propagation } from '../src';
import { AppModule, CustomTransactionProvider, RollbackError, UsingHookService } from './fixtures';

describe('@Transactional hooks UseCase', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
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
        listenerProvider: CustomTransactionProvider,
      },
      {
        case: Propagation.SUPPORTS,
        expectedCommitHookCalls: 1,
        expectedRollBackHookCalls: 0,
        listenerProvider: CustomTransactionProvider,
      },
    ];

    describe.each(propagationList)(
      '$case',
      ({ case: propagation, expectedCommitHookCalls, listenerProvider }) => {
        it('onCommit hook is called only when the transaction is committed.', async () => {
          const service = app.get(UsingHookService);
          const customTransactionProvider = app.get(listenerProvider);

          const onCommit = jest.spyOn(customTransactionProvider, 'onCommit');
          const onRollBack = jest.spyOn(customTransactionProvider, 'onRollBack');

          const targetMethodParams: Parameters<typeof service.createUserRequired> = [];

          if (propagation === Propagation.REQUIRED) {
            await service.createUserRequired(...targetMethodParams);
          } else {
            await service.createUserSupports(...targetMethodParams);
          }

          expect(onCommit).toBeCalledTimes(expectedCommitHookCalls);
          expect(onRollBack).toBeCalledTimes(0);
        });
      },
    );

    describe.each(propagationList)(
      '$case',
      ({ case: propagation, expectedRollBackHookCalls, listenerProvider }) => {
        it('onRollBack hook is called only when the transaction is rolled back.', async () => {
          const service = app.get(UsingHookService);
          const customTransactionProvider = app.get(listenerProvider);

          const onCommit = jest.spyOn(customTransactionProvider, 'onCommit');
          const onRollBack = jest.spyOn(customTransactionProvider, 'onRollBack');

          const throwErrorCallBack = () => {
            throw new RollbackError('Roll back!');
          };

          const targetMethodParams: Parameters<typeof service.createUserRequired> = [
            throwErrorCallBack,
          ];

          try {
            if (propagation === Propagation.REQUIRED) {
              await service.createUserRequired(...targetMethodParams);
            } else {
              await service.createUserSupports(...targetMethodParams);
            }
          } catch (e) {
            if (!(e instanceof RollbackError)) throw e;
          }

          expect(onCommit).toBeCalledTimes(0);
          expect(onRollBack).toBeCalledTimes(expectedRollBackHookCalls);
        });
      },
    );

    describe('Hook executed with proper arguments', () => {
      it('OnCommit hooks are called with the same arguments as the target method.', async () => {
        const service = app.get(UsingHookService);
        const customTransactionProvider = app.get(CustomTransactionProvider);
        const onCommit = jest.spyOn(customTransactionProvider, 'onCommit');

        const targetMethodParams: Parameters<typeof service.createUserRequired> = [
          () => null as never,
          1,
          2,
          3,
        ];

        await service.createUserRequired(...targetMethodParams);

        expect(onCommit).toBeCalledTimes(1);
        expect(onCommit).toBeCalledWith(...targetMethodParams);
      });

      it('OnRoollBack hooks are called with error and the same arguments as the target method.', async () => {
        const service = app.get(UsingHookService);
        const customTransactionProvider = app.get(CustomTransactionProvider);
        const onRollBack = jest.spyOn(customTransactionProvider, 'onRollBack');

        const throwErrorCallBack = () => {
          throw new RollbackError('First Argument is Error!');
        };

        const targetMethodParams: Parameters<typeof service.createUserRequired> = [
          throwErrorCallBack,
          1,
          2,
          3,
        ];

        try {
          await service.createUserRequired(...targetMethodParams);
        } catch (e) {
          if (!(e instanceof RollbackError)) throw e;
        }

        expect(onRollBack).toBeCalledTimes(1);
        expect(onRollBack).toBeCalledWith(
          new RollbackError('First Argument is Error!'),
          ...targetMethodParams,
        );
      });
    });
  });
});
