'use strict';
const portalDefinitions={student:['♙','Öğrenci girişi','Sınavlarım ve ödevlerim'],parent:['♡','Veli girişi','Gelişim takibi ve duyurular'],admin:['▥','Kurum yönetimi','Kurumunuzun yönetim alanı'],teacher:['▤','Öğretmen girişi','Dersler, sınavlar ve ödevler']};
function visiblePortalRoles(){
 const memberships=account?.institutions||[],roles=new Set(memberships.map(i=>i.role));
 if(roles.size&&![...roles].some(r=>r==='admin'||r==='teacher'))return ['student','parent'].filter(r=>roles.has(r));
 if(portalRole==='admin'||portalRole==='teacher')return [portalRole];
 return ['student','parent'];
}
function alignPortalWithMemberships(){const roles=visiblePortalRoles();if(account?.institutions.length&&portalRole&&!roles.includes(portalRole))portalRole=roles[0]||'';}
function canCreateInstitution(){return portalRole==='admin'&&!!account&&(!account.institutions.length||account.institutions.some(i=>i.role==='admin'));}
function portalFooter(){return visiblePortalRoles().map(r=>portalDefinitions[r][1]).join(' · ');}
function portalLoginTitle(){if(requestedInstitution)return requestedInstitution.name;const roles=visiblePortalRoles();return roles.includes(portalRole)?portalDefinitions[portalRole][1]:'Öğrenci ve veli girişi';}
function portalLoginSubtitle(){return visiblePortalRoles()[0]==='admin'?'Kurumunuzu ve ekibinizi tek yerden yönetin.':visiblePortalRoles()[0]==='teacher'?'Derslerinize ve öğrencilerinize kendi hesabınızla ulaşın.':'Sınavlar, ödevler ve gelişim takibi tek yerde.';}
function portalHelp(){return visiblePortalRoles()[0]==='admin'?'Kurum hesabınızın e-posta ve şifresiyle devam edin. İlk kullanımda hesap oluşturabilirsiniz.':'Kurumunuzun davet gönderdiği e-posta adresiyle giriş yapın. Şifrenizi hatırlamıyorsanız aşağıdan yenileyebilirsiniz.';}
function portalDemoLabel(){const r=visiblePortalRoles().includes(portalRole)?portalRole:visiblePortalRoles()[0];return r==='parent'?'Örnek veli panelini incele →':r==='teacher'?'Örnek öğretmen panelini incele →':r==='admin'?'Örnek kurum panelini incele →':'Örnek öğrenci panelini incele →';}
function invitationUrl(invite){const params=new URLSearchParams({invite:invite.code});if(portalDefinitions[invite.role])params.set('giris',invite.role);return location.origin+EDUCATION_ENTRY+'?'+params;}
