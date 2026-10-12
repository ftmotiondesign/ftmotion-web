// V32 common navigation on admin-only pages (page-specific authorization remains in place).
const pathname=location.pathname.split('/').pop();
const inMenu=/\/menu\//.test(location.pathname);
const rootPrefix=inMenu?'../':'';
const navigation=[['PANEL',null],['▦','Genel Bakış','panel.html'],['♙','İşletme Bilgileri','isletme-yonetimi.html'],['▣','QR / NFC Kart Yönetimi','qr-yonetimi.html'],['☷','Dijital Menü (Demo)','menu/index.html'],['KISAYOLLAR',null],['⚙','Merkezi Yönetim','yonetim.html'],['▤','Tüm İşletmeler','admin-isletmeler.html'],['📢','Duyuruları Yönet','admin-duyurular.html']];
const sidebar=document.createElement('aside');sidebar.className='ft-sidebar';sidebar.id='ftSidebar';
const brand=document.createElement('div');brand.className='ft-brand';brand.innerHTML='FT<span>Motion</span><small>İŞLETME KONTROL MERKEZİ</small>';sidebar.append(brand);
const nav=document.createElement('nav');nav.className='ft-nav';
for(const entry of navigation){if(entry[1]===null){const label=document.createElement('div');label.className='ft-label';label.textContent=entry[0];nav.append(label);continue;}const a=document.createElement('a');a.href=rootPrefix+entry[2];a.textContent=entry[0]+'  '+entry[1];if(entry[2]===pathname || (entry[2]==='menu/index.html'&&inMenu))a.setAttribute('aria-current','page');nav.append(a)}
sidebar.append(nav);
const mob=document.createElement('div');mob.className='ft-mobilebar';const toggle=document.createElement('button');toggle.type='button';toggle.textContent='☰ Menü';toggle.setAttribute('aria-controls','ftSidebar');toggle.setAttribute('aria-expanded','false');toggle.onclick=()=>{const open=sidebar.classList.toggle('ft-open');toggle.setAttribute('aria-expanded',String(open))};const logo=document.createElement('strong');logo.textContent='FTMotion · Yönetim';mob.append(toggle,logo);
const layout=document.createElement('div');layout.className='ft-layout';for(const node of [...document.body.children])layout.append(node);document.body.append(sidebar,mob,layout);
