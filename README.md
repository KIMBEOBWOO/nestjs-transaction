# Nestjs Transactional

![npm](https://img.shields.io/npm/dt/nestjs-transaction) ![npm](https://img.shields.io/npm/v/nestjs-transaction) ![GitHub issues](https://img.shields.io/github/issues-raw/KIMBEOBWOO/nestjs-transaction) ![GitHub Repo stars](https://img.shields.io/github/stars/KIMBEOBWOO/nestjs-transaction?style=social) ![GitHub forks](https://img.shields.io/github/forks/KIMBEOBWOO/nestjs-transaction?style=social)

## It's a fork of [typeorm-transactional](https://github.com/Aliheym/typeorm-transactional) for Nestjs customization

A `Transactional` Method Decorator for [typeorm](http://typeorm.io/) that uses [ALS](https://nodejs.org/api/async_context.html#class-asynclocalstorage) to handle and propagate transactions between different repositories and service methods.

To facilitate the use of [typeorm-transactional](https://github.com/Aliheym/typeorm-transactional) in Nest.js, several features have been added, including the `TransactionModule`, and the [@toss/nestjsaop](https://www.npmjs.com/package/@toss/nestjs-aop) library is being used to provide transaction capabilities that can be customized based on injectable providers in future services.

#### what's different

- **NESTED propagation properties have different behavior**
  NESTED transaction behaves the same as REQUIRED if it is a root transaction, but does not propagate its own rollback to parents if it is a child transaction
- **Declarative Event Hook feature**
  Declarative definition of handlers for transaction-related events such as onCommit, onRollback, etc., thus eliminating duplication of event handlers and designing flexible structures.
- **Includes testing and management of multiple data sources**

<br/>

## Index

<!-- @import "[TOC]" {cmd="toc" depthFrom=1 depthTo=6 orderedList=false} -->

<!-- code_chunk_output -->

- [Nestjs Transactional](#nestjs-transactional)
  - [It's a fork of typeorm-transactional for Nestjs customization](#its-a-fork-of-typeorm-transactionalhttpsgithubcomaliheymtypeorm-transactional-for-nestjs-customization)
      - [what's different](#whats-different)
  - [Index](#index)
  - [Installation](#installation)
  - [1️⃣ Usage](#1️⃣-usage)
  - [2️⃣ Using Transactional Decorator](#2️⃣-using-transactional-decorator)
  - [3️⃣ Data Sources](#3️⃣-data-sources)
    - [Multiple DataSources](#multiple-datasources)
    - [Select the name of the data source to participate](#select-the-name-of-the-data-source-to-participate)
  - [4️⃣ Transaction Propagation](#4️⃣-transaction-propagation)
    - [`REQUIRED(default)`](#requireddefault)
    - [`SUPPORTS`](#supports)
    - [`NESTED`](#nested)
    - [`REQUIRES_NEW`](#requires_new)
  - [5️⃣ Isolation Levels](#5️⃣-isolation-levels)
  - [6️⃣ Commit, RollBack hooks](#6️⃣-commit-rollback-hooks)
  - [7️⃣ Test Mocking](#7️⃣-test-mocking)
    - [Unit Test](#unit-test)
    - [Integration Test](#integration-test)
  - [8️⃣ API](#8️⃣-api)
    - [Transaction Options](#transaction-options)
    - [runOnTransactionCommit](#runontransactioncommit)
    - [runOnTransactionRollBack](#runontransactionrollback)
    - [addTransactionalDataSource(input): DataSource](#addtransactionaldatasourceinput-datasource)
- [⛔️ Bug Report](#️-bug-report)
    - [~~`@Transactonal` does not work when using an injected entity manager by `@InjectEntityManager`~~](#transactonal-does-not-work-when-using-an-injected-entity-manager-by-injectentitymanager)
      - [Fixed in version v1.1.2](#fixed-in-version-v112httpswwwnpmjscompackagenestjs-transactionv112)
- [👍 Stay in touch](#-stay-in-touch)
- [📜 License](#-license)

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

## 1️⃣ Usage

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

## 2️⃣ Using Transactional Decorator

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

## 3️⃣ Data Sources

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

## 4️⃣ Transaction Propagation

The following propagation options can be specified

### `REQUIRED(default)`

**Join** if there is a **transaction in progress**, and if there is **no transaction in progress**, **start a new transaction** with yourself as the root transaction.

### `SUPPORTS`

**Join** if there is a **transaction in progress**. This is exactly the same as what `REQUIRED` does. But if there is **no transaction in progress**, run a query **without a transaction.**

### `NESTED`

If there is **no transaction in progress**, **start a new transaction** with yourself as the root transaction. This is exactly the same as what `REQUIRED` does. If there is a transaction in progress, start a nested transaction.
Errors within overlapping transactions are not captured and rolled back by higher transactions. (If you want to spread errors within overlapping transactions to higher transactions, you should use 'REQUIRED.')

### `REQUIRES_NEW`

Always bring a new connection and **start a new transaction**.

<br/>

## 5️⃣ Isolation Levels

The following isolation level options can be specified:

- `READ_UNCOMMITTED` - A constant indicating that dirty reads, non-repeatable reads and phantom reads can occur.
- `READ_COMMITTED` - A constant indicating that dirty reads are prevented; non-repeatable reads and phantom reads can occur.
- `REPEATABLE_READ` - A constant indicating that dirty reads and non-repeatable reads are prevented; phantom reads can occur.
- `SERIALIZABLE` = A constant indicating that dirty reads, non-repeatable reads and phantom reads are prevented.

<br/>

## 6️⃣ Commit, RollBack hooks

With a custom event listener, **you can effectively design duplicate transaction event hooks**.

The library provides commit, rollback hooks provided by existing [typeorm-transactional](https://github.com/Aliheym/typeorm-transactional) as functions ([hooks API](#runontransactioncommit)), but additionally provides the ability to register the method to be executed after commit or rollback success in the form of a method decorator in the form of a listener.

```typescript
import { Injectable } from '@nestjs/common';
import { TransactionEventListener } from 'nestjs-transactional';
import { UserService } from './user.service';

@Injectable()
export class CustomTransactionEventListener implements TransactionEventListener {
  constructor(private readonly userService: UserService) {}

  async onCommit(...param: unknown[]): Promise<void> {
    await this.userService.userRepository.find();
  }

  async onRollBack(e: Error, ...param: unknown[]): Promise<void> {
    await this.userService.userRepository.find();
  }
}
```

The arguments for both the `onCommit` and `onRollback` methods are the same as the arguments for the target method, but for `onRollBack`, the **error object** that triggered rollback is additionally handed over to the first argument.

<br/>

```typescript
// user.module.ts
@Module({
  ...,
  controllers: [UserController],
  providers: [
    CustomTransactionEventListener,
  ],
})
export class UserModule {}
```

Transaction commit, rollback defines the functionality that should be executed upon successful implementation of the TransactionEventListener in the form of a provider. It is the same as a typical Nestjs provider and can be implemented by injecting other services within the module.

```typescript
@Transactional()
@TransactionalEventListeners(CustomTransactionEventListener)
async createUser(...param: unknown[]) {
  ...
}
```

<br/>

## 7️⃣ Test Mocking

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

> **Note**: This feature was **Deprecated** from `0.1.5^`.

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

## 8️⃣ API

### Transaction Options

```typescript
{
  connectionName?: string;
  isolationLevel?: IsolationLevel;
  propagation?: Propagation;
}
```

- `connectionName`: The name of the DataSource to use for this transactional context. It allows you to specify a specific DataSource if you have multiple DataSources configured in your application. ([the data sources](#data-sources))

- `isolationLevel`: The isolation level for the transactional context. Isolation levels define the degree to which one transaction must be isolated from the effects of other concurrent transactions. Common isolation levels include READ_COMMITTED, REPEATABLE_READ, and SERIALIZABLE. ([isolation levels](#isolation-levels))

- `propagation`: The propagation behavior for nest transactional contexts. Propagation determines how transactions should be propagated from one method to another. Common propagation behaviors include REQUIRED, REQUIRES_NEW, and NESTED. ([propagation behaviors](#transaction-propagation))

<br/>

### runOnTransactionCommit

The `runOnTransactionCommit` function is part of the `nestjs-transactional` package. It is used within the context of a transactional operation in TypeORM. This function allows you to specify a callback function that will be executed when the transaction is successfully committed.

When you perform a transactional operation, such as inserting, updating, or deleting data in a database, you want to ensure that the changes are applied atomically. This means that either all the changes are committed successfully, or none of them are applied at all. The `runOnTransactionCommit` function provides a way to execute additional logic or actions after the transaction is successfully committed.

To use `runOnTransactionCommit`, you need to pass a callback function as an argument. This callback function will be invoked only if the transaction is committed successfully. You can use this callback function to perform any additional tasks or actions that should be executed after the transaction is completed.

Here's an example of how you can use `runOnTransactionCommit`:

```typescript
import { runOnTransactionCommit } from 'nestjs-transactional';

@Injectable()
export class UserService {
    ...
    @Transactional()
    async createUser(id?: string) {
      const user = User.create({ id });

      await this.dataSource.manager.save(user);

      runOnTransactionCommit(async () => {
        await this.logService.saveSuccessLog(...);
        console.log('User Save Success.');
      });
    }
}
```

<br/>

### runOnTransactionRollBack

The `runOnTransactionRollback` function is part of the `typeorm` package. It is used within the context of a transactional operation in TypeORM. This function allows you to specify a callback function that will be executed when the transaction is rolled back.

A transaction is rolled back when an error occurs during the transactional operation. This means that all changes made during the transaction are undone, and the state of the database is reverted to what it was before the transaction started. The `runOnTransactionRollback` function provides a way to execute additional logic or actions after the transaction is rolled back.

To use `runOnTransactionRollback`, you need to pass a callback function as an argument. This callback function will be invoked only if the transaction is rolled back. You can use this callback function to perform any additional tasks or actions that should be executed after the transaction is rolled back.

Here's an example of how you can use `runOnTransactionRollback`:

```typescript
import { runOnTransactionRollback } from 'nestjs-transactional';

@Injectable()
export class UserService {
    ...
    @Transactional()
    async createUser(id?: string) {
      const user = User.create({ id });

      await this.dataSource.manager.save(user);

      runOnTransactionRollback(async (e: unknown) => {
        console.log('User Save Failed.', e);
        await this.logService.saveFailLog(...);
      });
    }
}
```

<br/>

### addTransactionalDataSource(input): DataSource

Add TypeORM `DataSource` to transactional context.

```typescript
addTransactionalDataSource(new DataSource(...));
addTransactionalDataSource({ name: 'default', : new DataSource(...) });
```

<br/>

# ⛔️ Bug Report

![GitHub issues](https://img.shields.io/github/issues-raw/KIMBEOBWOO/nestjs-transaction)

### ~~`@Transactonal` does not work when using an injected entity manager by `@InjectEntityManager`~~

#### Fixed in version [v1.1.2](https://www.npmjs.com/package/nestjs-transaction/v/1.1.2)

```ts
@Injectable()
export class UserService {
  constructor(@InjectEntityManager() readonly entityManager: EntityManager) {}

  @Transactional()
  updateUser(userId: string, data: Partial<User>) {
    return this.entityManager.update(User, userId, data);
  }
}
```

- Error reported in **nested transactions**

<br/>

# 👍 Stay in touch

Author/Developer - [KIMBEOBWOO](https://github.com/KIMBEOBWOO)

<br/>

# 📜 License

- It's a fork of [typeorm-transactional](https://github.com/Aliheym/typeorm-transactional)
- It's [MIT licensed](LICENSE).
