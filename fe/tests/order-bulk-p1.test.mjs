import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligibleBulkStep, processBulk } from '../src/components/admin-b/order-print-logic.ts';

test('bulk steps require a uniform eligible status and paid shipping orders', () => {
  const order = (status, paymentStatus = 'UNPAID') => ({ status, paymentStatus });
  assert.equal(eligibleBulkStep([]), undefined);
  assert.equal(eligibleBulkStep([order('PENDING'), order('PENDING')]).target, 'CONFIRMED');
  assert.equal(eligibleBulkStep([order('PENDING'), order('PACKING')]), undefined);
  assert.equal(eligibleBulkStep([order('SHIPPING', 'PAID'), order('SHIPPING')]), undefined);
  assert.equal(eligibleBulkStep([order('SHIPPING', 'PAID')]).target, 'COMPLETED');
  assert.equal(eligibleBulkStep([order('CANCELLED')]), undefined);
});
test('bulk processing continues after failures and reports each reason', async () => {
  const seen = [];
  const result = await processBulk([1, 2, 3], async id => { seen.push(id); if (id === 2) throw new Error('đã thay đổi'); }, (id, error) => `${id}: ${error.message}`);
  assert.deepEqual(seen, [1, 2, 3]);
  assert.deepEqual(result, { success: 2, errors: ['2: đã thay đổi'] });
});
