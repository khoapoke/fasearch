import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { orderDeliveryNote } from '../src/lib/order-delivery-note.ts';

test('shipping keeps status-only delivery instructions without recipient or actor markers', () => {
  assert.equal(orderDeliveryNote('[Người nhận: Lan - 0900000000] | [PACKING]: Gọi trước khi giao'), 'Gọi trước khi giao');
  assert.equal(orderDeliveryNote('[Người nhận: Lan - 0900000000] Giao buổi sáng | [PACKING]: Gói cẩn thận | [SHIPPING]: Gọi trước | [HỦY ĐƠN - NHÂN VIÊN private_login]: Không nhận'), 'Giao buổi sáng · Gói cẩn thận · Gọi trước');
  assert.equal(orderDeliveryNote(null), '');
});
test('print actually renders the delivery-note helper', () => {
  assert.match(readFileSync(new URL('../src/components/admin-b/order-print-page.tsx', import.meta.url), 'utf8'), /orderDeliveryNote\(order.note\)/);
});

test('audit routes require explicit view permission and never admit customers', async () => {
  const { routePermission, hasPermission } = await import('../src/lib/admin-roles.ts');
  assert.equal(routePermission('/quan-tri/nhat-ky'), 'AUDIT_VIEW');
  assert.equal(hasPermission('STAFF', [], 'AUDIT_VIEW'), false);
  assert.equal(hasPermission('STAFF', ['AUDIT_VIEW'], 'AUDIT_VIEW'), true);
  assert.equal(hasPermission('CUSTOMER', ['AUDIT_VIEW'], 'AUDIT_VIEW'), false);
});
test('audit filters encode literal special characters and transport preserves forbidden errors', async () => {
  const { auditQuery, auditRead } = await import('../src/lib/admin-audit.ts');
  const filters = { q: ' A&B%_ ', actor: '', from: '', to: '', objectType: 'PRODUCT', action: '' };
  assert.equal(new URLSearchParams(auditQuery(filters)).get('q'), 'A&B%_');
  assert.equal(new URLSearchParams(auditQuery(filters)).has('actor'), false);
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, '/api/admin/audit/123'); assert.equal(init.cache, 'no-store');
      return Response.json({ success: false, message: 'Không có quyền xem nhật ký.' }, { status: 403 });
    };
    await assert.rejects(auditRead('/123'), /Không có quyền xem nhật ký/);
  } finally { globalThis.fetch = original; }
});
