import { Injectable } from '@nestjs/common';
import { getDataSource, TYPEORM_DEFAULT_DATA_SOURCE_NAME } from '../common';
import { PropagationType, Propagation } from '../enums';
import { TransactionalError } from '../errors';
import { storage } from '../storage';
import { TransactionDemacrcation } from './transaction-demacrcation';

@Injectable()
export class TransactionDemacrcationFactory {
  constructor(
    private readonly newTransactionDemacrcation: TransactionDemacrcation,
    private readonly runOriginalAndEventTransactionDemacrcation: TransactionDemacrcation,
    private readonly runOriginalTransactionDemacrcation: TransactionDemacrcation,
    private readonly wrapTransactionDemacrcation: TransactionDemacrcation,
  ) {}

  getInstance(propagation: PropagationType, isActive: boolean): TransactionDemacrcation {
    switch (propagation) {
      case Propagation.NESTED:
        if (isActive) {
          return this.wrapTransactionDemacrcation;
        } else {
          return this.newTransactionDemacrcation;
        }
      case Propagation.REQUIRED:
        if (isActive) {
          return this.runOriginalTransactionDemacrcation;
        } else {
          return this.newTransactionDemacrcation;
        }
      case Propagation.SUPPORTS:
        if (isActive) {
          return this.runOriginalTransactionDemacrcation;
        } else {
          return this.runOriginalAndEventTransactionDemacrcation;
        }
      case Propagation.REQUIES_NEW:
        storage.set(
          TYPEORM_DEFAULT_DATA_SOURCE_NAME,
          getDataSource(TYPEORM_DEFAULT_DATA_SOURCE_NAME).createQueryRunner(),
        );

        return this.newTransactionDemacrcation;
      default:
        throw new TransactionalError('Not supported propagation type');
    }
  }
}
