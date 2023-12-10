import { Injectable } from '@nestjs/common';
import { PropagationType, Propagation } from '../enums';
import { TransactionalError } from '../errors';
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
      default:
        throw new TransactionalError('Not supported propagation type');
    }
  }
}
