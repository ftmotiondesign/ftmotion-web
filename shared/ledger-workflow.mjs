export const activePayments = rows => rows.filter(row=>!row.voided_at);
export function mergeDrafts(remote,local){
 const byKey=new Map();for(const row of [...remote,...local]){const prev=byKey.get(row.draft_key);if(!prev||row.updated_at>prev.updated_at)byKey.set(row.draft_key,row);}
 return [...byKey.values()].sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
}
export function spokenAmount(text){
 const words={sıfır:0,bir:1,iki:2,üç:3,dört:4,beş:5,altı:6,yedi:7,sekiz:8,dokuz:9,on:10,yirmi:20,otuz:30,kırk:40,elli:50,altmış:60,yetmiş:70,seksen:80,doksan:90};
 const currency=/\b(?:tl|lira|türk lirası)\b/giu;let match;
 while((match=currency.exec(text))){
  const tokens=text.slice(0,match.index).trim().split(/\s+/),parts=[];
  for(let i=tokens.length-1;i>=0;i--){const word=tokens[i].toLocaleLowerCase('tr-TR').replace(/^[^\wçğıöşü]+|[^\wçğıöşü.,]+$/gu,'');if(word in words||['yüz','bin','milyon'].includes(word)||/^\d[\d.,]*$/.test(word))parts.unshift(word);else break;}
  if(!parts.length)continue;
  let sum=0,group=0;
  for(const part of parts){
   if(part==='yüz')group=(group||1)*100;
   else if(part==='bin'||part==='milyon'){sum+=(group||1)*(part==='bin'?1000:1000000);group=0;}
   else if(part in words)group+=words[part];
   else {let raw=part;if(/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(raw))raw=raw.replace(/\./g,'');group+=Number(raw.replace(',','.'));}
  }
  const cents=Math.round((sum+group)*100);if(Number.isSafeInteger(cents)&&cents>=0&&cents<=100000000000)return cents;
 }
 return null;
}
export function parseSpokenQuote(text,customers=[]){
 const transcript=String(text).trim(),normalized=transcript.toLocaleLowerCase('tr-TR');
 const matches=customers.filter(c=>normalized.includes(c.name.toLocaleLowerCase('tr-TR')));
 return {customer_id:matches.length===1?matches[0].id:null,title:transcript.slice(0,200),terms:transcript,unit_price_cents:spokenAmount(normalized)};
}
