import test from 'node:test';
import assert from 'node:assert/strict';
import {SECTORS,sectorProfile,sectorStage,quoteSectorRows} from '../shared/ledger-sectors.mjs';
import {documentHTML} from '../shared/ledger-core.mjs';
test('sector stages stay independent and unknown profiles fall back safely',()=>{
 assert.equal(Object.keys(SECTORS).length,4);
 assert.equal(sectorProfile('unknown'),SECTORS.general);
 const customer={sector_data:{education:{stage:'registered'},wholesale:{stage:'ordered'}}};
 assert.equal(sectorStage(customer,'education')[1],'Kesin kayıt');
 assert.equal(sectorStage(customer,'wholesale')[1],'Sipariş alındı');
 assert.equal(sectorStage(customer,'driving_school')[0],'new');
});
test('recipient sector fields exclude guardian, stage and unknown private fields',()=>{
 const document={sector:'education',sector_details:{grade:'8',program:'LGS',guardian_name:'PRIVATE',stage:'registered',secret:'PRIVATE'}};
 assert.deepEqual(quoteSectorRows(document),[{label:'Sınıf / seviye',value:'8'},{label:'Eğitim programı',value:'LGS'}]);
 const version={quote_id:'abcdef00-1234',revision:1,created_at:'2026-10-22',document:{...document,title:'Kurs',business:{name:'Okul'},customer:{name:'Öğrenci'},items:[],total_cents:0}};
 version.document.sector_details.program='<img onerror="x">';
 const html=documentHTML(version,[]);
 assert.ok(html.includes('EĞİTİM ÜCRET TEKLİFİ'));
 assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img onerror'));assert.ok(!html.includes('PRIVATE'));
 delete version.document.sector;
 assert.ok(documentHTML(version,[]).includes('TEKLİF FORMU'));
});
