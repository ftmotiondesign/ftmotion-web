import {sectorProfile,quoteSectorRows} from './ledger-sectors.mjs?v=3';
import {money,dateLabel} from './ledger-core.mjs?v=3';
import {activePayments} from './ledger-workflow.mjs?v=3';
const asset=path=>new URL('../assets/ledger/'+path,import.meta.url).href;
let dependencyPromise;
function script(src){return new Promise((resolve,reject)=>{const tag=document.createElement('script');tag.src=src;tag.onload=resolve;tag.onerror=()=>{tag.remove();reject(Error('PDF bileşeni yüklenemedi. Tekrar deneyin.'));};document.head.append(tag);});}
async function dependencies(){
 if(!dependencyPromise)dependencyPromise=(async()=>{await Promise.all([globalThis.PDFLib?null:script(asset('vendor/pdf-lib-1.17.1.min.js')),globalThis.fontkit?null:script(asset('vendor/fontkit-1.1.1.min.js'))]);const response=await fetch(asset('fonts/DejaVuSans-Latin.ttf'));if(!response.ok)throw Error('PDF yazı tipi yüklenemedi.');return {pdfLib:globalThis.PDFLib,fontkit:globalThis.fontkit,fontBytes:await response.arrayBuffer()};})().catch(error=>{dependencyPromise=null;throw error;});
 return dependencyPromise;
}
export async function createQuotePDF(version,paymentRows=[],injected){
 const {pdfLib,fontkit,fontBytes}=injected||await dependencies(),{PDFDocument,rgb}=pdfLib;
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);const font=await doc.embedFont(fontBytes,{subset:true});
 const glyphs=new Set(font.getCharacterSet()),clean=value=>Array.from(String(value??'')).map(c=>c==='\n'||glyphs.has(c.codePointAt(0))?c:'?').join('');
 const ink=rgb(.13,.16,.2),gray=rgb(.4,.44,.49),orange=rgb(.92,.42,.06),d=version.document,payments=activePayments(paymentRows);
 let page,y;const width=511,left=42;
 const newPage=()=>{page=doc.addPage([595.28,841.89]);y=795;};newPage();
 function space(height){if(y-height<55)newPage();}
 function wrap(text,size=10,max=width){
  const lines=[];for(const paragraph of clean(text).replace(/\r/g,'').split('\n')){let line='';for(const word of paragraph.split(/\s+/)){let remaining=word;if(font.widthOfTextAtSize((line?line+' ':'')+word,size)<=max){line+=(line?' ':'')+word;continue;}if(line){lines.push(line);line='';}while(font.widthOfTextAtSize(remaining,size)>max){let n=1;while(n<remaining.length&&font.widthOfTextAtSize(remaining.slice(0,n+1),size)<=max)n++;lines.push(remaining.slice(0,n));remaining=remaining.slice(n);}line=remaining;}lines.push(line);}return lines;
 }
 function text(value,{size=10,color=ink,max=width,x=left,gap=5}={}){for(const line of wrap(value,size,max)){space(size+gap);page.drawText(line,{x,y,size,font,color});y-=size+gap;}return y;}
 let logo=null;
 if(!injected&&/^https:\/\//i.test(d.business.logo_url||'')){
  try{const response=await fetch(d.business.logo_url,{referrerPolicy:'no-referrer',signal:AbortSignal.timeout(5000)});if(response.ok){let bytes=new Uint8Array(await response.arrayBuffer());if(bytes[0]===137&&bytes[1]===80)logo=await doc.embedPng(bytes);else if(bytes[0]===255&&bytes[1]===216)logo=await doc.embedJpg(bytes);else{const bitmap=await createImageBitmap(new Blob([bytes])),canvas=document.createElement('canvas');canvas.width=Math.min(600,bitmap.width);canvas.height=Math.max(1,Math.round(bitmap.height*canvas.width/bitmap.width));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));bitmap.close();if(blob)logo=await doc.embedPng(await blob.arrayBuffer());}}}catch{}
 }
 if(logo){const scaled=logo.scale(Math.min(80/logo.width,52/logo.height));page.drawImage(logo,{x:left+width-scaled.width,y:805-scaled.height,width:scaled.width,height:scaled.height});}
 text(d.business.name,{size:20,max:logo?width-95:width});text([d.business.phone,d.business.email,d.business.address].filter(Boolean).join(' · '),{size:9,color:gray});
 space(35);y-=8;page.drawLine({start:{x:left,y},end:{x:left+width,y},thickness:2,color:orange});y-=24;
 text(sectorProfile(d.sector).documentTitle,{size:14,color:orange});text(`#${version.quote_id.slice(0,8).toUpperCase()} / Sürüm ${version.revision} · ${dateLabel(version.created_at)}`,{size:9,color:gray});y-=14;
 text('SAYIN',{size:8,color:gray});text(d.customer.name,{size:13});text([d.customer.phone,d.customer.email,d.customer.address].filter(Boolean).join(' · '),{size:9});y-=14;text(d.title,{size:14});for(const row of quoteSectorRows(d))text(row.label+': '+row.value,{size:10});y-=8;
 const xs=[left,left+270,left+320,left+416],cols=[260,45,90,95];
 function tableHead(){space(34);page.drawRectangle({x:left,y:y-7,width,height:23,color:rgb(.96,.96,.97)});['Ürün / Hizmet','Miktar','Birim fiyat','Tutar'].forEach((label,i)=>page.drawText(label,{x:xs[i],y,size:8,font,color:gray}));y-=26;}
 tableHead();
 for(const item of d.items){const cells=[item.name,item.quantity,money(item.unit_price_cents),money(item.line_cents)].map((v,i)=>wrap(v,9,cols[i]));let offset=0;
  while(offset<Math.max(...cells.map(c=>c.length))){if(y<80){newPage();tableHead();}const linesAvailable=Math.max(1,Math.floor((y-60)/13)),count=Math.min(linesAvailable,Math.max(...cells.map(c=>c.length))-offset);for(let line=0;line<count;line++){cells.forEach((lines,i)=>{if(lines[offset+line]!==undefined)page.drawText(lines[offset+line],{x:xs[i],y:y-line*13,size:9,font,color:ink});});}y-=count*13;offset+=count;if(offset<Math.max(...cells.map(c=>c.length))){newPage();tableHead();}}
  y-=9;page.drawLine({start:{x:left,y:y+4},end:{x:left+width,y:y+4},thickness:.4,color:rgb(.87,.89,.91)});
 }
 y-=12;space(100);text('Ara toplam: '+money(d.subtotal_cents),{x:left+280,max:231});text('İndirim: '+money(d.discount_cents),{x:left+280,max:231});text(`KDV (%${d.vat_percent}): ${money(d.vat_cents)}`,{x:left+280,max:231});text('GENEL TOPLAM: '+money(d.total_cents),{size:13,color:orange,x:left+200,max:311});y-=18;
 text('Şartlar ve iş kapsamı',{size:12});text(d.terms||'Ek şart belirtilmedi.');text('Teklif geçerlilik tarihi: '+dateLabel(version.valid_until),{size:9});y-=14;
 text(version.current_revision&&version.revision!==version.current_revision?'Güncel işin ödeme özeti':'Ödeme özeti',{size:12});
 for(const p of payments)text(`${dateLabel(p.paid_on)} · ${money(p.amount_cents)}`,{size:9});
 const paid=payments.reduce((sum,p)=>sum+Number(p.amount_cents),0);text('Alınan ödeme: '+money(paid));text('Kalan tutar: '+money((version.current_total_cents??d.total_cents)-paid));text('Ödeme kaydı fatura veya resmî makbuz yerine geçmez.',{size:8,color:gray});
 const pages=doc.getPages();pages.forEach((p,i)=>p.drawText(clean(`${d.business.name} · #${version.quote_id.slice(0,8).toUpperCase()} / ${version.revision} · ${i+1}/${pages.length}`),{x:left,y:28,size:8,font,color:gray}));
 doc.setTitle(d.title);doc.setAuthor(d.business.name);return doc.save();
}
export async function downloadQuotePDF(version,payments=[],share=false){
 const bytes=await createQuotePDF(version,payments),name=`Teklif-${version.quote_id.slice(0,8).toUpperCase()}-V${version.revision}.pdf`,file=new File([bytes],name,{type:'application/pdf'});
 if(share&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:version.document.title});return;}catch(error){if(error.name==='AbortError')return;}}
 const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=name;a.className='button secondary pdf-download-ready';a.textContent='PDF hazır — indir';document.querySelectorAll('.pdf-download-ready').forEach(previous=>{URL.revokeObjectURL(previous.href);previous.remove();});const host=[...document.querySelectorAll('dialog[open]')].at(-1)||document.body;host.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},300000);
}
