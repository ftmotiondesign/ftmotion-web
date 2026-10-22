import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,decimalUnits,escapeHTML,whatsappPhone,documentHTML} from '../shared/ledger-core.mjs';
test('TL values retain kuruş and reject malformed or overflowing money',()=>{
 assert.equal(decimalUnits('1234,56'),123456);assert.equal(decimalUnits('0.01'),1);
 for(const input of ['-1','NaN','1.123','1e3','Infinity',''])assert.throws(()=>decimalUnits(input));
});
test('camera quote, deposit, discount and VAT use integer currency arithmetic',()=>{
 const rows=[{name:'Kamera',quantity:4,unit_price_cents:400000},{name:'Montaj',quantity:1,unit_price_cents:200000}];
 assert.equal(calculate(rows).total_cents,1800000);assert.equal(calculate(rows).total_cents-500000,1300000);
 assert.deepEqual(calculate(rows,100000,20),{subtotal_cents:1800000,discount_cents:100000,vat_cents:340000,total_cents:2040000});
 assert.equal(calculate([{name:'Kesirli iş',quantity:1.005,unit_price_cents:100}]).total_cents,101);
 assert.throws(()=>calculate(rows,1800001));assert.throws(()=>calculate(rows,0,101));assert.throws(()=>calculate([{name:'İş',quantity:0,unit_price_cents:1}]));
});
test('recipient document escapes untrusted text and forbids unsafe image URLs',()=>{
 const v={quote_id:'abcdef00-1234',revision:1,created_at:'2026-10-22',valid_until:'2026-11-01',document:{title:'<script>alert(1)</script>',customer:{name:'<img onerror="x">'},business:{name:'Firma',logo_url:'javascript:alert(1)'},items:[],total_cents:1800000,subtotal_cents:1800000,discount_cents:0,vat_percent:0,vat_cents:0,terms:'Özel şart'}};
 const html=documentHTML(v,[{amount_cents:500000,paid_on:'2026-10-22'}]);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('javascript:'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('13.000'));assert.equal(escapeHTML('"&'), '&quot;&amp;');
});
test('WhatsApp numbers normalize Turkish local and international formats',()=>{
 assert.equal(whatsappPhone('0534 781 51 05'),'905347815105');assert.equal(whatsappPhone('+90 534 781 51 05'),'905347815105');assert.equal(whatsappPhone('0044 7700 900123'),'447700900123');assert.equal(whatsappPhone('abc'),'');
});
