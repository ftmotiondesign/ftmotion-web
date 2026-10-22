import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteRows,filterQuotes,quoteSummary,quoteState,quoteDay} from '../shared/admin-quotes-core.mjs';
const quotes=[{id:'q1',business_id:'b1',current_revision:2},{id:'q2',business_id:'b2',current_revision:1},{id:'q3',business_id:'b1',current_revision:1}];
const versions=[{quote_id:'q1',revision:1,total_cents:99000,created_at:'2026-10-01T10:00:00Z',title:'Eski teklif'},{quote_id:'q1',revision:2,total_cents:10000,created_at:'2026-10-22T22:00:00Z',valid_until:'2026-11-01',response:'accepted',title:'Eğitim paketi',customer_name:'IŞIL'},{quote_id:'q2',revision:1,total_cents:20000,created_at:'2026-10-22T10:00:00Z',valid_until:'2026-11-01',title:'Kamera',customer_name:'Ayşe'},{quote_id:'q3',revision:1,total_cents:30000,created_at:'2026-10-21T10:00:00Z',valid_until:'2026-10-21',title:'Kurs',customer_name:'Ali'}];
const payments=[{quote_id:'q1',amount_cents:1000},{quote_id:'q1',amount_cents:5000,voided_at:'2026-10-20'},{quote_id:'q2',amount_cents:2000}];
const businesses=[{id:'b1',name:'Kale Truva'},{id:'b2',name:'Poyraz Bilgisayar'}];
test('admin summary counts only current versions and active payments across businesses',()=>{
 const rows=quoteRows(quotes,versions,payments,businesses);
 assert.equal(rows.length,3);assert.equal(rows[0].version.revision,2);assert.equal(rows[0].paid,1000);assert.equal(rows[0].remaining,9000);
 assert.deepEqual(quoteSummary(rows),{count:3,total:60000,paid:3000,receivable:27000});
 assert.throws(()=>quoteRows(quotes,versions.slice(2),payments,businesses),/son sürümü/);
});
test('business, Turkish search, inclusive Istanbul dates and status filters compose',()=>{
 const rows=quoteRows(quotes,versions,payments,businesses),today='2026-10-22';
 assert.equal(quoteDay('2026-10-22T22:00:00Z'),'2026-10-23');
 assert.deepEqual(filterQuotes(rows,{business:'b1',search:'ışıl',status:'accepted',from:'2026-10-23',to:'2026-10-23'},today).map(r=>r.id),['q1']);
 assert.deepEqual(filterQuotes(rows,{status:'expired'},today).map(r=>r.id),['q3']);
 assert.equal(filterQuotes(rows,{business:'b2',search:'Kurs'},today).length,0);
 assert.equal(quoteState({response:'changes',valid_until:'2020-01-01'},today),'changes');
 assert.equal(quoteState({valid_until:today},today),'pending');
});
