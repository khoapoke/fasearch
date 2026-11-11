import { test } from 'node:test';
import { fetchOwnLoyaltyHistory } from '../src/lib/benefits-client.ts';
import assert from 'node:assert/strict';
import { returnApi, returnStatuses, returnReasons } from '../src/lib/return-client.ts';
import { loyaltyHistoryAmount, loyaltyActionLabel } from '../src/lib/benefits.ts';
import { hasPermission, routePermission } from '../src/lib/admin-roles.ts';
test('returns transport preserves server refusal and never manufactures success', async () => {
 const previous=globalThis.fetch;
 try {
  globalThis.fetch=async()=>Response.json({success:false,message:'Đơn đã hết hạn.'},{status:400});
  await assert.rejects(()=>returnApi('/api/customer-commerce/returns',{}),/Đơn đã hết hạn/);
  globalThis.fetch=async()=>Response.json({success:true,result:{refundAmount:80000,refundId:'re_a'}});
  assert.deepEqual(await returnApi('/api/admin/returns/1/refund',{}),{refundAmount:80000,refundId:'re_a'});
 } finally {globalThis.fetch=previous;}
});
test('return ledger debits and credits have the correct sign and Vietnamese labels',()=>{
 assert.deepEqual(loyaltyHistoryAmount('RETURN_REVERSE',17),{text:'−17 điểm',direction:'down'});
 assert.deepEqual(loyaltyHistoryAmount('RETURN_REDEEM',10),{text:'+10 điểm',direction:'up'});
 assert.deepEqual(loyaltyHistoryAmount('RETURN_REVERSE',0),{text:'0 điểm',direction:'flat'});
 assert.equal(loyaltyActionLabel('RETURN_REVERSE'),'Thu hồi điểm đơn trả');
 assert.equal(loyaltyActionLabel('RETURN_REDEEM'),'Hoàn điểm đã đổi');
});
test('return route and refund action require their separate permissions',()=>{
 assert.equal(routePermission('/quan-tri/doi-tra'),'RETURN_VIEW');
 assert.equal(hasPermission('STAFF',['RETURN_VIEW','RETURN_PROCESS'],'RETURN_REFUND'),false);
 assert.equal(hasPermission('ADMIN',[],'RETURN_REFUND'),true);
 assert.equal(hasPermission('CUSTOMER',['RETURN_REFUND'],'RETURN_REFUND'),false);
 assert.equal(Object.keys(returnStatuses).length,6);assert.equal(Object.keys(returnReasons).length,5);
});

test('loyalty history accepts return credits, debits and zero deductions from a shortfall',async()=>{
 const previous=globalThis.fetch;
 try {
  const content=['RETURN_REVERSE','RETURN_REDEEM','RETURN_REVERSE'].map((type,i)=>({entryId:i+1,type,points:i===2?0:10,orderId:89,occurredAt:'2026-11-09T18:00:00'}));
  globalThis.fetch=async()=>Response.json({success:true,result:{content,pageNumber:0,pageSize:20,totalElements:3,totalPages:1,last:true}});
  const page=await fetchOwnLoyaltyHistory('');assert.equal(page.data.length,3);assert.equal(page.data[2].points,0);
 } finally {globalThis.fetch=previous;}
});

test('manual online methods use shop refund wording and require evidence before sending', async () => {
 const {refundMethodLabel, returnActionError, refundStatus}=await import('../src/lib/return-client.ts');
 for(const method of ['CASH','VNPAY','VNPAY_QR','BANK_TRANSFER','MOMO','E_WALLET']) {
  assert.equal(refundMethodLabel(method),'Hoàn thủ công qua cửa hàng');
  assert.match(returnActionError('refund','  ',method),/chứng từ/);
  assert.equal(returnActionError('refund','Chứng từ đã chi',method),'');
 }
 assert.equal(returnActionError('refund','','STRIPE'),'');
 assert.match(returnActionError('cancel',''),/lý do hủy/);
 assert.equal(returnStatuses.CANCELLED,'Đã hủy');
 assert.equal(refundStatus(240000,270000),'Đã hoàn một phần');
 assert.equal(refundStatus(270000,270000),'Đã hoàn tiền');
});
test('return BFF errors preserve actual business reason while generic commerce keeps its contract',async()=>{
 const {formatCommerceUpstreamError}=await import('../src/lib/customer-commerce.ts');
 const payload={code:1003,message:'Vui lòng ghi chú chứng từ hoàn tiền thủ công.'};
 assert.equal(formatCommerceUpstreamError(400,payload,true,true).body.message,payload.message);
 assert.equal(formatCommerceUpstreamError(400,payload,true).body.message,'Yêu cầu chưa thể xử lý. Kiểm tra lại dữ liệu.');
 assert.equal(formatCommerceUpstreamError(502,{message:'Stripe từ chối hoàn tiền, thử lại'},true,true).body.message,'Stripe từ chối hoàn tiền, thử lại');
 assert.equal(formatCommerceUpstreamError(500,{message:'java.sql.password=secret'},true,true).body.message,'Dịch vụ đang bận. Thử lại sau.');
});
test('customer order notes render Vietnamese statuses and keep cancellation reasons without actor tokens',async()=>{
 const {parseCustomerOrderNote}=await import('../src/lib/order-recipient.ts');
 const parsed=parseCustomerOrderNote('[Người nhận: Nguyễn An - 0901234567] Giao buổi chiều | [PACKING]: Đang đóng gói | [SHIPPING]: Đã giao cho đơn vị vận chuyển | [HỦY ĐƠN - admin]: Khách đổi ý');
 assert.deepEqual(parsed.recipient,{name:'Nguyễn An',phone:'0901234567'});
 assert.equal(parsed.text,'Giao buổi chiều');
 assert.deepEqual(parsed.transitions,[{status:'PACKING',note:'Đang đóng gói'},{status:'SHIPPING',note:'Đã giao cho đơn vị vận chuyển'}]);
 assert.deepEqual(parsed.cancellations,['Khách đổi ý']);
});
