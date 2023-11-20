/**
 * Transaction Lazy Decorator Token
 */
export const TRANSACTION_DECORATOR = Symbol('TRANSACTION_DECORATOR');
export const TYPEORM_ENTITY_MANAGER_NAME = '@nestjs-transactional/entity-manager';

export const TYPEORM_DEFAULT_DATA_SOURCE_NAME = 'default' as const;
export const TYPEORM_DATA_SOURCE_NAME = '@transactional/data-source';
