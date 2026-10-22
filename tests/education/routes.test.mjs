import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const html=fs.readFileSync('404.html','utf8'),script=html.match(/<script>([\s\S]+)<\/script>/)[1];
function navigate(pathname,search=''){const redirects=[],requests=[],context={location:{pathname,search,origin:'https://ftmotion.com',replace:url=>redirects.push(url)},URL,URLSearchParams,document:{body:{style:{}}},fetch:url=>{requests.push(url);return new Promise(()=>{})}};vm.runInNewContext(script,context);return {redirects,requests};}
test('QR kartın kısa adresi aynı hedefe yönlenir',()=>{const r=navigate('/qr/firma-adi');assert.equal(r.requests.length,0);const u=new URL(r.redirects[0]);assert.equal(u.pathname,'/qr/');assert.equal(u.searchParams.get('short'),'firma-adi');assert.equal(u.searchParams.get('cleanpath'),'firma-adi')});
test('Kart stok kodunun yönlendirmesi korunur',()=>{assert.equal(navigate('/k/qr-1001').redirects[0],'/k/?code=QR-1001')});
test('QR ek sayfa yönlendirmesi korunur',()=>{const u=new URL(navigate('/qr/firma-adi/iban').redirects[0]);assert.equal(u.searchParams.get('page'),'iban')});
test('Kurum adresi yalnızca eğitim adresi çözümlemesini çağırır',()=>{const r=navigate('/yeni-kurum');assert.equal(r.redirects.length,0);assert.match(r.requests[0],/education-api\/resolve\?slug=yeni-kurum$/)});
