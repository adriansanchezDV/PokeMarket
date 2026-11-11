import { QueryTypes, type Transaction } from 'sequelize';
import { CartItem, Notification, Order, OrderItem } from '../../src/models/indexModel.js';
import sequelize from './testDatabase.js';

// A named, temporary lifecycle hook issues a real PostgreSQL error in the current transaction.
// It does not replace application services, models, or their SQL operations.
export const failTransactionAt = (stage: 'cart-clear' | 'notification', failAt = 1) => {
  const state = { calls: 0, transactionId: '', orders: 0, items: 0, notifications: 0 };
  const fail = async (transaction?: Transaction | null) => {
    state.calls++;
    if (state.calls !== failAt) return;
    if (!transaction)
      throw new Error('Fault injection must run inside the application transaction');
    const [row] = await sequelize.query<{ id: string }>('SELECT txid_current()::text AS id', {
      transaction,
      type: QueryTypes.SELECT,
    });
    state.transactionId = row.id;
    state.orders = await Order.count({ transaction });
    state.items = await OrderItem.count({ transaction });
    state.notifications = await Notification.count({ transaction });
    await sequelize.query('SELECT 1 / 0', { transaction });
  };
  const name = 'test-real-transaction-error';
  if (stage === 'cart-clear')
    CartItem.addHook('beforeBulkDestroy', name, (options) => fail(options.transaction));
  else
    Notification.addHook('beforeCreate', name, (_notification, options) =>
      fail(options.transaction),
    );
  return {
    state,
    remove: () => {
      if (stage === 'cart-clear') CartItem.removeHook('beforeBulkDestroy', name);
      else Notification.removeHook('beforeCreate', name);
    },
  };
};
