# Nestjs Transactional

[![npm version](http://img.shields.io/npm/v/typeorm-transactional.svg?style=flat)](https://npmjs.org/package/nestjs-transactional 'View this project on npm')

## It's a fork of [typeorm-transactional](https://github.com/Aliheym/typeorm-transactional) for Nestjs customization

A `Transactional` Method Decorator for [typeorm](http://typeorm.io/) that uses [ALS](https://nodejs.org/api/async_context.html#class-asynclocalstorage) to handle and propagate transactions between different repositories and service methods.

To facilitate the use of [typeorm-transactional](https://github.com/Aliheym/typeorm-transactional) in Nest.js, several features have been added, including the `TransactionModule`, and the [@toss/nestjsaop](https://www.npmjs.com/package/@toss/nestjs-aop) library is being used to provide transaction capabilities that can be customized based on injectable providers in future services.

<!-- @import "[TOC]" {cmd="toc" depthFrom=1 depthTo=6 orderedList=false} -->

<!-- code_chunk_output -->

- [Nestjs Transactional](#nestjs-transactional)
  - [It's a fork of typeorm-transactional for Nestjs customization](#its-a-fork-of-typeorm-transactionalhttpsgithubcomaliheymtypeorm-transactional-for-nestjs-customization)
  - [Installation](#installation)
  - [Usage](#usage)
  - [Using Transactional Decorator](#using-transactional-decorator)
  - [Data Sources](#data-sources)
    - [Multiple DataSources](#multiple-datasources)
    - [Select the name of the data source to participate](#select-the-name-of-the-data-source-to-participate)
  - [Transaction Propagation](#transaction-propagation)
  - [Isolation Levels](#isolation-levels)
  - [Test Mocking](#test-mocking)
    - [Unit Test](#unit-test)
    - [Integration Test](#integration-test)
  - [API](#api)
    - [Transaction Options](#transaction-options)
    - [addTransactionalDataSource(input): DataSource](#addtransactionaldatasourceinput-datasource)

<!-- /code_chunk_output -->

<br/>

## Installation

```shell
## npm
npm install --save nestjs-transaction

## Needed dependencies
npm install --save typeorm reflect-metadata
```

Or

```shell
yarn add nestjs-transaction

## Needed dependencies
yarn add typeorm reflect-metadata
```

> **Note**: You will need to import `reflect-metadata` somewhere in the global place of your app - https://github.com/typeorm/typeorm#installation

<br/>

## Usage

New versions of TypeORM use `DataSource` instead of `Connection`, so most of the API has been changed and the old API has become deprecated.

Register `TransactionModule` with `AppModule`. Once the module is registered, it automatically finds all TypeORM DataSources that exist and adds them to the Transactional DataSource so that `@Transactional` can be used.

Example for `Nest.js`:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TransactionModule } from 'nestjs-transactional;

@Module({
  imports: [
    TransactionModule.forRoot()
  ],
})
export class AppModule {}
```

Unlike `typeorm-transactional-cls-hooked`, you do not need to use `BaseRepository`or otherwise define repositories.

**NOTE** You can [select](#select-the-name-of-the-data-source-to-participate) specific `DataSource` if you need it

<br/>

## Using Transactional Decorator

- Every service method that needs to be transactional, need to use the `@Transactional()` decorator
- The decorator can take a `connectionName` as argument (by default it is `default`) to specify [the data source ](#data-sources) to be user
- The decorator can take an optional `propagation` as argument to define the [propagation behaviour](#transaction-propagation)
- The decorator can take an optional `isolationLevel` as argument to define the [isolation level](#isolation-levels) (by default it will use your database driver's default isolation level)

```typescript
export class PostService {
  constructor(readonly repository: PostRepository);

  @Transactional() // Will open a transaction if one doesn't already exist
  async createPost(id, message): Promise<Post> {
    const post = this.repository.create({ id, message });
    return this.repository.save(post);
  }
}
```

You can also use `DataSource`/`EntityManager` objects together with repositories in transactions:

```typescript
export class PostService {
  constructor(readonly repository: PostRepository, readonly dataSource: DataSource);

  @Transactional() // Will open a transaction if one doesn't already exist
  async createAndGetPost(id, message): Promise<Post> {
    const post = this.repository.create({ id, message });

    await this.repository.save(post);

    return dataSource.createQueryBuilder(Post, 'p').where('id = :id', id).getOne();
  }
}
```

<br/>

## Data Sources

### Multiple DataSources

In new versions of `TypeORM` the `name` property in `Connection` / `DataSource` is deprecated, so to work conveniently with multiple `DataSource` the function `addTransactionalDataSource` allows you to specify custom the name.

```typescript
@Module({
  imports: [
    TransactionModule.forRoot(),

    // Postgres Database
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: '127.0.0.1',
        port: 5435,
        username: 'beobwoo',
        password: 'testtest',
        database: 'test_db',
      }),
    }),
    // Postgres Database 2
    TypeOrmModule.forRoot({
      name: 'second-data-source',
      type: 'postgres',
      host: '127.0.0.1',
      port: 5436,
      username: 'beobwoo',
      password: 'testtest',
      database: 'test_db_2',
    }),
  ],
  providers: [],
})
export class AppModule {}
```

If you don't specify a name, it defaults to `default`.

Now, you can use this `name` in API by passing the `connectionName` property as options to explicitly define which `Data Source` you want to use:

```typescript
  @Transactional({ connectionName: 'second-data-source' })
  async fn() { ... }
```

OR

```typescript
runInTransaction(
  () => {
    // ...
  },
  { connectionName: 'second-data-source' },
);
```

> **Note**: If you use `TypeORM.forRootAsync` when Nest.js uses DataSourceName, you must also enter the name attribute in the body. - [Nestjs Docs](https://docs.nestjs.com/techniques/database)

<br/>

### Select the name of the data source to participate

If you register using the forRoot method, you need the ability to **select** from `multiple DataSources`. If used without additional options, register all `DataSources` automatically.

```typescript
TransactionModule.forRoot({
  dataSourceNames: ['default'], // if you want regist Default DataSource only (no name TypeORM dataSource)
}),
```

<br/>

## Transaction Propagation

The following propagation options can be specified:

- `REQUIRED` (default behaviour) - Support a current transaction, create a new one if none exists.
- `SUPPORTS` - Support a current transaction, execute non-transactionally if none exists.

<br/>

## Isolation Levels

The following isolation level options can be specified:

- `READ_UNCOMMITTED` - A constant indicating that dirty reads, non-repeatable reads and phantom reads can occur.
- `READ_COMMITTED` - A constant indicating that dirty reads are prevented; non-repeatable reads and phantom reads can occur.
- `REPEATABLE_READ` - A constant indicating that dirty reads and non-repeatable reads are prevented; phantom reads can occur.
- `SERIALIZABLE` = A constant indicating that dirty reads, non-repeatable reads and phantom reads are prevented.

<br/>

## Test Mocking

### Unit Test

`@Transactional` can be mocked to prevent running any of the transactional code in unit tests.

This can be accomplished in Jest with:

```typescript
jest.mock('nestjs-transactional', () => ({
  Transactional: () => () => ({}),
}));
```

Repositories, services, etc. can be mocked as usual.

<br/>

### Integration Test

```tsx
import { getTestQueryRunnerToken, TestTransactionModule } from 'nestjs-transaction';

beforeAll(async () => {
  const module = await Test.createTestingModule({
    imports: [
      AppModule,
      TestTransactionModule.forRoot(), // <-- if regist TestTransactionModule, you can use testQueryRunner
    ],
  }).compile();

  app = module.createNestApplication();
  await app.init(); // NOTE : TransactionModule using lifecycle hooks
  dataSource = app.get<DataSource>(getDataSourceToken());

  // A QueryRunner used by @Transactional applied methods
  // while participating in a transaction to execute a query
  testQueryRunner = app.get<QueryRunner>(getTestQueryRunnerToken());
});

beforeEach(async () => {
  await testQueryRunner.startTransaction();
});

afterEach(async () => {
  await testQueryRunner.rollbackTransaction();
});

it('it should be return ResponseDTO Array in body', async () => {
  const response = await request(app.getHttpServer())
    .patch(`/v1/<<url>>`)
    .send(dto)
    .expect(HttpStatus.OK);

  expect(response.body).toStrictEqual([]);
});
```

When using the above method in integrated tests using `jest`, each test result is automatically **rolled back**, eliminating the need to clean the table data after each test. This requires additional recall of `TestTransactionModule`, as opposed to registering only `AppModule` in general.

`TestQueryRunner` is not available unless you have registered a `TestTransactionModule`. It is of course possible to manually clean the test data without registering the `TestTransactionModule`.

<br/>

## API

### Transaction Options

```typescript
{
  connectionName?: string;
  isolationLevel?: IsolationLevel;
  propagation?: Propagation;
}
```

- `connectionName`- DataSource name to use for this transactional context ([the data sources](#data-sources))
- `isolationLevel`- isolation level for transactional context ([isolation levels](#isolation-levels) )
- `propagation`- propagation behaviors for nest transactional contexts ([propagation behaviors](#transaction-propagation))

<br/>

### addTransactionalDataSource(input): DataSource

Add TypeORM `DataSource` to transactional context.

```typescript
addTransactionalDataSource(new DataSource(...));
addTransactionalDataSource({ name: 'default', : new DataSource(...) });
```

<br/>
