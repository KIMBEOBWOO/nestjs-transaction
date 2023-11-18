# Nestjs Transactional

[![npm version](http://img.shields.io/npm/v/typeorm-transactional.svg?style=flat)](https://npmjs.org/package/nestjs-transactional 'View this project on npm')

## It's a fork of [typeorm-transactional](https://github.com/Aliheym/typeorm-transactional) for Nestjs customization

A `Transactional` Method Decorator for [typeorm](http://typeorm.io/) that uses [ALS](https://nodejs.org/api/async_context.html#class-asynclocalstorage) to handle and propagate transactions between different repositories and service methods.

<!-- @import "[TOC]" {cmd="toc" depthFrom=1 depthTo=6 orderedList=false} -->

<!-- code_chunk_output -->

- [Typeorm Transactional](#typeorm-transactional)
  - [It's a fork of typeorm-transactional for Nestjs customization](#its-a-fork-of-typeorm-transactionalhttpsgithubcomaliheymtypeorm-transactional-for-nestjs-customization)
  - [Installation](#installation)
  - [Usage](#usage)
  - [Using Transactional Decorator](#using-transactional-decorator)
  - [Data Sources](#data-sources)
  - [Transaction Propagation](#transaction-propagation)
  - [Isolation Levels](#isolation-levels)
  - [Unit Test Mocking](#unit-test-mocking)
  - [API](#api)
    - [Transaction Options](#transaction-options)
    - [addTransactionalDataSource(input): DataSource](#addtransactionaldatasourceinput-datasource)
    - [runInTransaction(fn: Callback, options?: Options): Promise<...>](#runintransactionfn-callback-options-options-promise)
    - [wrapInTransaction(fn: Callback, options?: Options): WrappedFunction](#wrapintransactionfn-callback-options-options-wrappedfunction)

<!-- /code_chunk_output -->

<br/>

## Installation

```shell
## npm
npm install --save nestjs-transactional

## Needed dependencies
npm install --save typeorm reflect-metadata
```

Or

```shell
yarn add nestjs-transactional

## Needed dependencies
yarn add typeorm reflect-metadata
```

> **Note**: You will need to import `reflect-metadata` somewhere in the global place of your app - https://github.com/typeorm/typeorm#installation

**IMPORTANT NOTE**

Calling [initializeTransactionalContext](#initialization) must happen BEFORE any application context is initialized!

---

## Usage

New versions of TypeORM use `DataSource` instead of `Connection`, so most of the API has been changed and the old API has become deprecated.

To be able to use TypeORM entities in transactions, you must first add a DataSource using the `addTransactionalDataSource` function:

Example for `Nest.js`:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from 'nestjs-transactional;
import { mainDataSourceOpiton, subDataSourceOption } from './data-sources';

@Module({
  imports: [
    // Postgres Database
    TypeOrmModule.forRootAsync({
      useFactory: () => mainDataSourceOpiton,
      // dataSource receives the configured DataSourceOptions
      // and returns a Promise<DataSource>.
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('Invalild DataSource options');
        }

        return addTransactionalDataSource(new DataSource(options));
      },
    }),
    // Postgres Database 2
    TypeOrmModule.forRootAsync({
      name: LOG_DB_NAME,
      useFactory: () => subDataSourceOption,
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('Invalild DataSource options');
        }

        return addTransactionalDataSource(new DataSource(options));
      },
    }),
  ],
  providers: [],
})
export class DatabaseModule {}
```

Unlike `typeorm-transactional-cls-hooked`, you do not need to use `BaseRepository`or otherwise define repositories.

**NOTE**: You can [add](#data-sources) multiple `DataSource` if you need it

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

In new versions of `TypeORM` the `name` property in `Connection` / `DataSource` is deprecated, so to work conveniently with multiple `DataSource` the function `addTransactionalDataSource` allows you to specify custom the name:

```typescript
addTransactionalDataSource({
	name: 'second-data-source',
	dataSource: new DataSource(...)
});
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

## Unit Test Mocking

`@Transactional` can be mocked to prevent running any of the transactional code in unit tests.

This can be accomplished in Jest with:

```typescript
jest.mock('typeorm-transactional', () => ({
  Transactional: () => () => ({}),
}));
```

Repositories, services, etc. can be mocked as usual.

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

### addTransactionalDataSource(input): DataSource

Add TypeORM `DataSource` to transactional context.

```typescript
addTransactionalDataSource(new DataSource(...));

addTransactionalDataSource({ name: 'default', dataSource: new DataSource(...), patch: true });
```

### runInTransaction(fn: Callback, options?: Options): Promise<...>

Run code in transactional context.

```typescript
...

runInTransaction(() => {
	...

	const user = this.usersRepo.update({ id: 1000 }, { state: action });

	...
}, { propagation: Propagation.REQUIRES_NEW });

...
```

### wrapInTransaction(fn: Callback, options?: Options): WrappedFunction

Wrap function in transactional context

```typescript
...

const updateUser = wrapInTransaction(() => {
	...

	const user = this.usersRepo.update({ id: 1000 }, { state: action });

	...
}, { propagation: Propagation.NEVER });

...

await updateUser();


```
