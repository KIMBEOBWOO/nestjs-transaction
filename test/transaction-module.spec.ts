import { Test } from '@nestjs/testing';
import { TransactionModule } from '../src';
import { getDataSource, TYPEORM_DEFAULT_DATA_SOURCE_NAME } from '../src/common';
import { DatabaseModule, LOG_DB_NAME } from './fixtures';

describe('TransactionModule', () => {
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
