import { DataSource, EntityManager, QueryBuilder } from 'typeorm';
import { Counter, SubCounter } from '../fixtures';

/**
 * Objects that provide the TypeORM query method
 * @example DataSource.query
 */
interface Queryable {
  query: typeof DataSource.prototype.query | typeof EntityManager.prototype.query;
}

/**
 * Returns if the current transaction ID is assigned
 * @param queryable Queryable, Function that return QueryBuilder
 * @returns Current Trasaction ID
 *
 * @link [txid_current_if_assigned](https://pgpedia.info/t/txid_current_if_assigned.html)
 * @NOTE Basic usage example for txid_current_if_assigned() - a transaction will not have a transaction ID until it makes a change to the database:
 */
export const getCurrentTransactionId = async (
  queryable: Queryable | (() => QueryBuilder<any>),
  db: 'main' | 'sub' = 'main',
): Promise<number | null> => {
  let id: string | null = null;

  if (typeof queryable === 'function') {
    const qb = queryable();

    await qb
      .insert()
      .into('counters')
      .values({ value: () => 'DEFAULT' })
      .execute();

    const schema = db === 'main' ? Counter : SubCounter;
    const result = await qb
      .select('txid_current_if_assigned()', 'txid_current_if_assigned')
      .from(schema, 'counter')
      .getRawOne();

    id = result?.txid_current_if_assigned || null;
  } else {
    await queryable.query('INSERT INTO "counters" values (default)');
    const result = await queryable.query('SELECT txid_current_if_assigned()');

    id = result[0]?.txid_current_if_assigned || null;
  }

  return id ? Number.parseInt(id, 10) : null;
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
