import { Test } from '@nestjs/testing';
import { TransactionModule } from '../../src';
import {
  DEFAUL_MAX_EVENT_LISTENERS,
  getDataSource,
  storeOption,
  TYPEORM_DEFAULT_DATA_SOURCE_NAME,
} from '../../src/common';
import { DatabaseModule, LOG_DB_NAME } from '../fixtures';

describe('TransactionModule', () => {
  describe('DataSources', () => {
    it('If the dataSource Name array is delivered to the option, only the DataSource with the name delivered to the dataSources array should be added to the transaction DataSource.', async () => {
      const module = await Test.createTestingModule({
        imports: [
          TransactionModule.forRoot({
            dataSourceNames: [TYPEORM_DEFAULT_DATA_SOURCE_NAME],
          }),
          DatabaseModule,
        ],
      }).compile();

      const app = module.createNestApplication();
      await app.init();

      try {
        expect(() => getDataSource(TYPEORM_DEFAULT_DATA_SOURCE_NAME)).toBeDefined();
        expect(() => getDataSource(LOG_DB_NAME)).toThrow(
          new Error(
            'There is no registered DataSource. DataSource must be registered through addTransactionalDataSource.',
          ),
        );
      } finally {
        await app.close();
      }
    });

    it('If a dataSources array is not given, all DataSources must be added to the transaction DataSources.', async () => {
      const module = await Test.createTestingModule({
        imports: [TransactionModule.forRoot(), DatabaseModule],
      }).compile();

      const app = module.createNestApplication();
      await app.init();

      try {
        expect(() => getDataSource(TYPEORM_DEFAULT_DATA_SOURCE_NAME)).toBeDefined();
        expect(() => getDataSource(LOG_DB_NAME)).toBeDefined();
      } finally {
        await app.close();
      }
    });
  });

  describe('StoreOption', () => {
    beforeEach(() => {
      storeOption.maxEventListeners = DEFAUL_MAX_EVENT_LISTENERS;
    });

    it('If the maxEventListeners option is not given, the default value must be 100.', async () => {
      const module = await Test.createTestingModule({
        imports: [TransactionModule.forRoot({}), DatabaseModule],
      }).compile();

      const app = module.createNestApplication();
      await app.init();

      try {
        expect(storeOption.maxEventListeners).toBe(DEFAUL_MAX_EVENT_LISTENERS);
      } finally {
        await app.close();
      }
    });

    it('If the maxEventListeners option is given, the value must be set to the StoreOption.', async () => {
      const customMaxEventListeners = 1000;
      const module = await Test.createTestingModule({
        imports: [
          TransactionModule.forRoot({ maxEventListeners: customMaxEventListeners }),
          DatabaseModule,
        ],
      }).compile();

      const app = module.createNestApplication();
      await app.init();

      try {
        expect(storeOption.maxEventListeners).toBe(customMaxEventListeners);
      } finally {
        await app.close();
      }
    });
  });
});
