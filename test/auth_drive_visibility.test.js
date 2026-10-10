/**
 * Test Suite: Firebase Kimlik Doğrulama, Google Drive Görünürlük Kuralları & Admin Yetkilendirme
 * Minecraft Milyoner Platformu (v0.0.1)
 */

const assert = require('assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('TEST 1: Bağımsız Veri Sıfırlama Modülü & Güvenlik Koruması');
console.log('====================================================');

// 1.1: Onay parametresi olmadan çalıştırma engellenmeli (exit code 1)
try {
  execSync('node scripts/reset_platform_data.js', { stdio: 'pipe' });
  assert.fail('HATA: Onay parametresi olmadan betik çalışmamalıydı!');
} catch (err) {
  assert.strictEqual(err.status, 1, 'Onay parametresi verilmediğinde çıkış kodu 1 olmalıdır.');
  const output = err.stderr ? err.stderr.toString() : err.stdout.toString();
  assert(
    output.includes('--confirm-reset-all-data'),
    'Hata çıktısı --confirm-reset-all-data parametresini istemelidir.'
  );
  console.log('✓ Onay parametresi olmadan silme engellendi (Güvenli çıkış kodu 1).');
}

// 1.2: Doğru onay parametresi ile çalıştırma
try {
  const result = execSync('node scripts/reset_platform_data.js --confirm-reset-all-data', {
    stdio: 'pipe'
  }).toString();
  assert(result.includes('BAŞARIYLA SIFIRLANDI'), 'Sıfırlama başarıyla tamamlanmalıdır.');
  console.log('✓ Onay parametresi ile sıfırlama işlemi başarıyla çalıştı.');
} catch (err) {
  assert.fail('Sıfırlama betiği çalışırken hata oluştu: ' + err.message);
}

console.log('\n====================================================');
console.log('TEST 2: Mock Browser Ortamı & Servislerin Yüklenmesi');
console.log('====================================================');

// Mock localStorage
const storageStore = {};
const localStorageMock = {
  getItem: key => (Object.prototype.hasOwnProperty.call(storageStore, key) ? storageStore[key] : null),
  setItem: (key, val) => {
    storageStore[key] = String(val);
  },
  removeItem: key => {
    delete storageStore[key];
  },
  clear: () => {
    Object.keys(storageStore).forEach(k => delete storageStore[k]);
  }
};

// Global Browser Mock
global.window = {
  localStorage: localStorageMock,
  location: { hash: '' },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {}
};
global.localStorage = localStorageMock;
global.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelector: () => null,
  querySelectorAll: () => []
};

// services.js ve economy.js dosyalarını yükle
const servicesCode = fs.readFileSync(path.join(__dirname, '..', 'services.js'), 'utf8');
const economyCode = fs.readFileSync(path.join(__dirname, '..', 'economy.js'), 'utf8');

eval(servicesCode);
eval(economyCode);

if (window.MCMServices?.cloudSyncService) {
  window.MCMServices.cloudSyncService.syncNow = async () => {};
  window.MCMServices.cloudSyncService.pushNow = async () => {};
  window.MCMServices.cloudSyncService.schedulePush = () => {};
}
const { authGuard, userService, authService, leaderboardService, otpService } = window.MCMServices;
assert(authGuard, 'authGuard servisi bulunamadı!');
assert(userService, 'userService bulunamadı!');
assert(authService, 'authService bulunamadı!');
assert(leaderboardService, 'leaderboardService bulunamadı!');
assert(otpService, 'otpService bulunamadı!');
console.log('✓ Servis katmanı ve OTP servisi başarıyla yüklendi.');

console.log('\n====================================================');
console.log('TEST 3: Admin Yetkilendirme & Sahte Oturum Koruması');
console.log('====================================================');

const SUPER_ADMIN = 'codingdevelopia@gmail.com';

// 3.1: Sahte Admin oturumu (isAdminSession: true fakat e-posta farklı)
const fakeAdminSession = {
  username: 'attacker',
  isAdminSession: true,
  email: 'attacker@evil.com'
};
const fakeRank = authGuard.getEffectiveRankId(fakeAdminSession);
const fakeRole = authGuard.getEffectiveRole(fakeAdminSession);
assert.notStrictEqual(fakeRank, 'ADMIN', 'Sahte admin asla ADMIN rütbesi alamaz!');
assert.notStrictEqual(fakeRole, 'ADMIN', 'Sahte admin asla ADMIN rolü alamaz!');
assert.strictEqual(fakeRank, 'MEMBER', 'Yetkisiz oturum MEMBER rütbesine düşürülmelidir.');
console.log('✓ Sahte admin oturum talebi reddedildi (MEMBER olarak kısıtlandı).');

// 3.2: authGuard.requireRole koruması
assert.throws(
  () => authGuard.requireRole(fakeAdminSession, 'ADMIN'),
  /Erişim Reddedildi|codingdevelopia@gmail\.com/i,
  'Sahte admin requireRole ADMIN çağrısında hata fırlatmalıdır.'
);
console.log('✓ authGuard.requireRole sahte oturumu engelledi.');

// 3.3: Gerçek Admin oturumu (codingdevelopia@gmail.com)
const validAdminSession = {
  username: 'codingdevelopia',
  isAdminSession: true,
  email: SUPER_ADMIN
};
const validRank = authGuard.getEffectiveRankId(validAdminSession);
const validRole = authGuard.getEffectiveRole(validAdminSession);
assert.strictEqual(validRank, 'ADMIN', 'codingdevelopia@gmail.com ADMIN rütbesine sahip olmalıdır.');
assert.strictEqual(validRole, 'ADMIN', 'codingdevelopia@gmail.com ADMIN rolüne sahip olmalıdır.');
assert.doesNotThrow(
  () => authGuard.requireRole(validAdminSession, 'ADMIN'),
  'codingdevelopia@gmail.com için requireRole ADMIN onaylanmalıdır.'
);
console.log('✓ codingdevelopia@gmail.com için ADMIN yetkisi başarıyla doğrulandı.');

console.log('\n====================================================');
console.log('TEST 4: Google Drive Görünürlük & Veri Katmanı Koruması');
console.log('====================================================');

// Test kullanıcılarını kaydet
const userWithoutDrive = {
  userId: 'usr_no_drive',
  username: 'PlayerNoDrive',
  minecraftPlayerName: 'SteveNoDrive',
  emeraldBalance: 5000,
  netheriteBalance: 1200,
  points: 85000,
  gamesWon: 12,
  gamesPlayed: 15,
  drivePermissionGranted: false,
  vipPlusBonusRuleMigrated: true
};

const userWithDrive = {
  userId: 'usr_with_drive',
  username: 'PlayerWithDrive',
  minecraftPlayerName: 'SteveWithDrive',
  emeraldBalance: 9000,
  netheriteBalance: 2500,
  points: 150000,
  gamesWon: 20,
  gamesPlayed: 22,
  drivePermissionGranted: true,
  vipPlusBonusRuleMigrated: true
};

userService._saveAllUsers([userWithoutDrive, userWithDrive]);

// 4.1: Drive izni olmayan oyuncunun profili 3. şahıs tarafından görüntülendiğinde
const strangerViewer = { username: 'OtherPlayer', email: 'other@test.com' };
const restrictedProfile = userService.getUserPublicProfile('PlayerNoDrive', strangerViewer);

assert(restrictedProfile, 'Profil nesnesi dönmelidir.');
assert.strictEqual(restrictedProfile._isRestricted, true, 'Drive izni yoksa _isRestricted true olmalıdır.');
assert.strictEqual(restrictedProfile.username, 'PlayerNoDrive', 'Kullanıcı adı görünür olmalıdır.');
assert.strictEqual(restrictedProfile.minecraftPlayerName, 'SteveNoDrive', 'Minecraft adı görünür olmalıdır.');
// Veri katmanı seviyesinde hassas alanların gizlenmesi:
assert.strictEqual(restrictedProfile.emeraldBalance, null, 'Zümrüt bakiyesi veri katmanında null olmalıdır.');
assert.strictEqual(restrictedProfile.netheriteBalance, null, 'Netherite bakiyesi veri katmanında null olmalıdır.');
assert.strictEqual(restrictedProfile.points, null, 'Puan veri katmanında null olmalıdır.');
assert.strictEqual(restrictedProfile.gamesWon, null, 'Kazanma sayısı veri katmanında null olmalıdır.');
assert.strictEqual(restrictedProfile.gamesPlayed, null, 'Oynanan oyun sayısı veri katmanında null olmalıdır.');
assert.deepStrictEqual(restrictedProfile.achievements, [], 'Başarımlar boş dizi olmalıdır.');
console.log('✓ Drive izni vermeyen oyuncunun bakiyeleri ve istatistikleri veri katmanında başarıyla gizlendi (null).');

// 4.2: Drive izni olmayan oyuncunun profili KENDİSİ tarafından görüntülendiğinde
const selfViewer = { username: 'PlayerNoDrive', email: 'nodrive@test.com' };
const selfProfile = userService.getUserPublicProfile('PlayerNoDrive', selfViewer);
assert.strictEqual(selfProfile._isRestricted, false, 'Oyuncu kendi profilini tam görebilmelidir.');
assert.strictEqual(selfProfile.emeraldBalance, 5000, 'Oyuncu kendi zümrüt bakiyesini görebilmelidir.');
assert.strictEqual(selfProfile.netheriteBalance, 1200, 'Oyuncu kendi netherite bakiyesini görebilmelidir.');
console.log('✓ Oyuncu kendi profilini tam yetkiyle görüntüleyebiliyor.');

// 4.3: Drive izni olmayan oyuncunun profili ADMİN (codingdevelopia@gmail.com) tarafından görüntülendiğinde
const adminViewer = { username: 'AdminMaster', email: SUPER_ADMIN };
const adminViewOfProfile = userService.getUserPublicProfile('PlayerNoDrive', adminViewer);
assert.strictEqual(adminViewOfProfile._isRestricted, false, 'Admin oyuncu profilini tam görebilmelidir.');
assert.strictEqual(adminViewOfProfile.emeraldBalance, 5000, 'Admin bakiyeyi görebilmelidir.');
console.log('✓ Admin (codingdevelopia@gmail.com) profili tam olarak görüntüleyebiliyor.');

// 4.4: Drive izni olan oyuncunun profili herkese açık görüntülendiğinde
const openProfile = userService.getUserPublicProfile('PlayerWithDrive', strangerViewer);
assert.strictEqual(openProfile._isRestricted, false, 'Drive izni olan oyuncu kısıtlanmamalıdır.');
assert.strictEqual(openProfile.emeraldBalance, 9000, 'Zümrüt bakiyesi görünür olmalıdır.');
assert.strictEqual(openProfile.netheriteBalance, 2500, 'Netherite bakiyesi görünür olmalıdır.');
assert.strictEqual(openProfile.points, 150000, 'Puan görünür olmalıdır.');
console.log('✓ Drive izni veren oyuncunun profili liderlik ve genel görünüme tam olarak açık.');

console.log('\n====================================================');
console.log('TEST 5: Liderlik Tablosu Veri Katmanı Görünürlük Projeksiyonu');
console.log('====================================================');

const lbRows = leaderboardService.getLeaderboard({ sortBy: 'points' });
const rowNoDrive = lbRows.find(r => r.username === 'PlayerNoDrive');
const rowWithDrive = lbRows.find(r => r.username === 'PlayerWithDrive');

assert(rowNoDrive, 'PlayerNoDrive liderlik tablosunda yer almalıdır.');
assert(rowWithDrive, 'PlayerWithDrive liderlik tablosunda yer almalıdır.');

// Kısıtlı satır projeksiyonu kontrolü
assert.strictEqual(rowNoDrive._isRestricted, true, 'Liderlik satırında _isRestricted true olmalıdır.');
assert.strictEqual(rowNoDrive.points, null, 'Liderlik satırında points null olmalıdır.');
assert.strictEqual(rowNoDrive.emeraldBalance, null, 'Liderlik satırında emeraldBalance null olmalıdır.');
assert.strictEqual(rowNoDrive.netheriteBalance, null, 'Liderlik satırında netheriteBalance null olmalıdır.');
assert.strictEqual(rowNoDrive.gamesWon, null, 'Liderlik satırında gamesWon null olmalıdır.');
assert.strictEqual(rowNoDrive.gamesPlayed, null, 'Liderlik satırında gamesPlayed null olmalıdır.');
console.log('✓ Liderlik tablosunda Drive izni olmayan satırın tüm skor ve bakiyeleri veri katmanında sıfırlandı.');

// İzinli satır projeksiyonu kontrolü
assert.strictEqual(rowWithDrive._isRestricted, false, 'İzinli liderlik satırında _isRestricted false olmalıdır.');
assert.strictEqual(rowWithDrive.points, 150000, 'İzinli satırda puan görünmelidir.');
assert.strictEqual(rowWithDrive.emeraldBalance, 9000, 'İzinli satırda zümrüt görünmelidir.');
console.log('✓ Liderlik tablosunda Drive izni olan satırın verileri eksiksiz listelendi.');

console.log('\n====================================================');
console.log('TEST 6: Birleşik Giriş (Admin, Moderatör ve Üyenin Giriş Yap Ekranından Girişi)');
console.log('====================================================');

const crypto = require('crypto');
const sha256Node = str => crypto.createHash('sha256').update(str, 'utf8').digest('hex');
const AUTH_SALT_CONST = 'MCM_2026_SALT';

(async () => {
  try {
    // 6.1: Moderatör hesabı oluştur ve Giriş Yap ile gir
    await authService.registerAccount({
      username: 'ModeratorTest',
      password: 'modpass123',
      passwordConfirm: 'modpass123'
    });
    userService.syncUserFields('ModeratorTest', {
      rank: 'MODERATOR',
      role: 'MODERATOR',
      isModerator: true
    });

    const modSession = await authService.login({ username: 'ModeratorTest', password: 'modpass123' });
    assert.strictEqual(modSession.role, 'MODERATOR', 'Moderatör girişi MODERATOR rolü üretmelidir.');
    assert.strictEqual(modSession.isModerator, true, 'isModerator true olmalıdır.');
    assert.strictEqual(modSession.isAdminSession, false, 'Moderatör admin olamaz.');
    console.log('✓ Moderatör standart giriş formundan başarıyla MODERATOR rolüyle giriş yaptı.');

    // 6.2: Admin hesabı oluştur (codingdevelopia@gmail.com) ve Giriş Yap ile gir
    await authService.registerAccount({
      username: 'SuperAdminTest',
      password: 'adminpass123',
      passwordConfirm: 'adminpass123'
    });
    userService.syncUserFields('SuperAdminTest', {
      email: SUPER_ADMIN,
      rank: 'ADMIN',
      role: 'ADMIN',
      isModerator: true
    });

    const adminSession = await authService.login({ username: 'SuperAdminTest', password: 'adminpass123' });
    assert.strictEqual(adminSession.role, 'ADMIN', 'Admin girişi ADMIN rolü üretmelidir.');
    assert.strictEqual(adminSession.isAdminSession, true, 'Admin girişi isAdminSession=true üretmelidir.');
    assert.strictEqual(authGuard.getEffectiveRankId(adminSession), 'ADMIN', 'Effective rank ADMIN olmalıdır.');
    console.log('✓ Admin standart giriş formundan başarıyla ADMIN yetkisiyle giriş yaptı.');

    // 6.3: Standart Oyuncu Girişi
    await authService.registerAccount({
      username: 'RegularPlayer',
      password: 'playerpass123',
      passwordConfirm: 'playerpass123'
    });

    const regSession = await authService.login({ username: 'RegularPlayer', password: 'playerpass123' });
    assert.strictEqual(regSession.role, 'MEMBER', 'Normal oyuncu MEMBER rolü almalıdır.');
    assert.strictEqual(regSession.isAdminSession, false, 'Normal oyuncu admin oturumu alamaz.');
    assert.strictEqual(regSession.isModerator, false, 'Normal oyuncu moderatör olamaz.');
    console.log('✓ Normal üye standart giriş formundan başarıyla MEMBER rolüyle giriş yaptı.');

    // 6.4: codingdevelopia@gmail.com Harici Hesapların ADMIN Yetkisi Kazanmasının Engellenmesi
    await authService.registerAccount({
      username: 'HackerAttempt',
      password: 'hackerpass123',
      passwordConfirm: 'hackerpass123'
    });
    userService.syncUserFields('HackerAttempt', {
      email: 'hacker@evil.com',
      rank: 'ADMIN',
      role: 'ADMIN'
    });
    const hackerSession = await authService.login({ username: 'HackerAttempt', password: 'hackerpass123' });
    assert.strictEqual(hackerSession.role, 'MEMBER', 'Yetkisiz kullanıcı asla ADMIN rolü alamaz!');
    assert.strictEqual(hackerSession.rank, 'MEMBER', 'Yetkisiz kullanıcı asla ADMIN rütbesi alamaz!');
    assert.strictEqual(hackerSession.isAdminSession, false, 'Yetkisiz kullanıcı asla isAdminSession=true alamaz!');
    assert.strictEqual(authGuard.getEffectiveRankId(hackerSession), 'MEMBER', 'authGuard yetkisiz hesabı MEMBER olarak görmelidir.');
    console.log('✓ codingdevelopia@gmail.com harici hesapların ADMIN olma girişimi kesin olarak engellendi.');

    console.log('\n====================================================');
    console.log('TEST 7: Gmail & OTP Doğrulama ve Kullanıcı Adı/Şifre Belirleme');
    console.log('====================================================');

    // 7.1: OTP Üretimi
    const testEmail = 'newplayer@gmail.com';
    const otpResult = authService.generateOtp(testEmail);
    assert(otpResult.code && otpResult.code.length === 6, 'OTP kodu 6 haneli olmalıdır.');
    console.log(`✓ 6 haneli OTP kodu başarıyla üretildi (${otpResult.code}).`);

    // 7.2: Hatalı OTP Reddi
    assert.throws(
      () => authService.verifyOtp(testEmail, '000000'),
      /hatalı/i,
      'Hatalı kod girildiğinde hata fırlatmalıdır.'
    );
    console.log('✓ Hatalı OTP kodu başarıyla reddedildi.');

    // 7.3: Yeni Gmail Kullanıcısının OTP Doğrulaması ve Kullanıcı Adı + Şifre Belirlemesi
    const newGmailSession = await authService.registerWithGmailAndOtp({
      email: testEmail,
      otpCode: otpResult.code,
      username: 'GmailVerifiedHero',
      password: 'mypassword123',
      passwordConfirm: 'mypassword123',
      minecraftPlayerName: 'HeroSteve',
      drivePermissionGranted: true
    });
    assert.strictEqual(newGmailSession.username, 'GmailVerifiedHero', 'Kullanıcı adı atanmalıdır.');
    assert.strictEqual(newGmailSession.email, testEmail, 'Email doğru atanmalıdır.');
    assert.strictEqual(newGmailSession.role, 'MEMBER', 'Normal Gmail üyesi MEMBER rolü almalıdır.');
    assert.strictEqual(newGmailSession.isAdminSession, false, 'Normal Gmail üyesi admin olamaz.');
    assert.strictEqual(newGmailSession.drivePermissionGranted, true, 'Drive izni atanmalıdır.');
    console.log('✓ Yeni Gmail kullanıcısı OTP onayladı ve Kullanıcı Adı + Şifre belirleyerek kaydoldu.');

    // 7.4: Bu kullanıcının daha sonra normal Giriş Formundan Kullanıcı Adı ve Şifre ile girebilmesi
    const directLoginSession = await authService.login({
      username: 'GmailVerifiedHero',
      password: 'mypassword123'
    });
    assert.strictEqual(directLoginSession.username, 'GmailVerifiedHero');
    assert.strictEqual(directLoginSession.email, testEmail);
    console.log('✓ Gmail ile kaydolan kullanıcı daha sonra klasik formdan kullanıcı adı ve şifresiyle başarıyla girdi.');

    // 7.5: codingdevelopia@gmail.com'un Gmail & OTP ile kaydı durumunda ADMIN olması
    const adminOtp = authService.generateOtp('codingdevelopia@gmail.com');
    const gmailAdminSession = await authService.registerWithGmailAndOtp({
      email: 'codingdevelopia@gmail.com',
      otpCode: adminOtp.code,
      username: 'CodingDevAdmin',
      password: 'adminsecret123',
      passwordConfirm: 'adminsecret123',
      minecraftPlayerName: 'DevAdmin',
      drivePermissionGranted: true
    });
    assert.strictEqual(gmailAdminSession.role, 'ADMIN', 'codingdevelopia@gmail.com ADMIN rolü almalıdır.');
    assert.strictEqual(gmailAdminSession.isAdminSession, true, 'codingdevelopia@gmail.com isAdminSession=true almalıdır.');
    assert.strictEqual(authGuard.getEffectiveRankId(gmailAdminSession), 'ADMIN', 'Effective rank ADMIN olmalıdır.');
    console.log('✓ codingdevelopia@gmail.com Gmail & OTP ile Kullanıcı Adı ve Şifre belirleyip ADMIN olarak kaydoldu.');

    console.log('\n====================================================');
    console.log('TEST 8: Netherite Bonus Kademeleri (Üye: 0, VIP: 50, VIP+: 250)');
    console.log('====================================================');

    // 8.1: Normal Üye (MEMBER) 0 Netherite ile başlar
    const freshMember = userService.getUserByUsername('GmailVerifiedHero');
    assert.strictEqual(Number(freshMember.netheriteBalance || 0), 0, 'Normal üye kayıt olduğunda 0 Netherite almalıdır.');
    console.log('✓ Normal üye (MEMBER) kayıt ve girişte 0 Netherite aldı.');

    // 8.2: VIP Rütbesi tek seferlik 50 Netherite verir
    userService.syncUserFields('GmailVerifiedHero', { rank: 'VIP', role: 'VIP' });
    if (window.MCMServices?.netheriteService) {
      window.MCMServices.netheriteService.ensureInitialBonusOnce('GmailVerifiedHero');
      const vipUser = userService.getUserByUsername('GmailVerifiedHero');
      assert.strictEqual(Number(vipUser.netheriteBalance), 50, 'VIP rütbesi tek seferlik 50 Netherite vermelidir.');
      console.log('✓ VIP olan kullanıcıya tek seferlik 50 Netherite verildi.');

      // 8.3: VIP+ Rütbesine yükseldiğinde 250 Netherite'e tamamlanır (+200 eklenir)
      userService.syncUserFields('GmailVerifiedHero', { rank: 'VIP_PLUS', role: 'VIP' });
      window.MCMServices.netheriteService.ensureInitialBonusOnce('GmailVerifiedHero');
      const vipPlusUser = userService.getUserByUsername('GmailVerifiedHero');
      assert.strictEqual(Number(vipPlusUser.netheriteBalance), 250, 'VIP+ rütbesine yükseldiğinde toplam 250 Netherite tamamlanmalıdır.');
      console.log('✓ VIP+ rütbesine yükselen kullanıcı toplam 250 Netherite bonusuna ulaştı.');
    }

    // ====================================================
    // TEST 9: Parti Maçı Eşzamanlı Başlatma & Jüri / Katılımcı Rolü
    // ====================================================
    console.log('\n====================================================');
    console.log('TEST 9: Parti Maçı Senkronizasyonu & Jüri/Katılımcı Rolü');
    console.log('====================================================');

    const partyService = window.MCMServices.partyService;

    // 9.1: Lider parti kurar
    const pLeaderSession = await authService.login({ username: 'RegularPlayer', password: 'playerpass123' });
    const createdParty = partyService.createParty(pLeaderSession, 'Turnuva Odası 1');
    assert.strictEqual(createdParty.leaderUsername, 'RegularPlayer', 'Lider RegularPlayer olmalıdır.');
    assert.strictEqual(createdParty.hostRole, 'JUDGE', 'Yeni partide lider varsayılan olarak JUDGE (Jüri) rolünde olmalıdır.');
    console.log('✓ Lider partiyi kurdu ve varsayılan rolü JUDGE (Jüri) olarak atandı.');

    // 9.2: Lider rolünü PLAYER (Katılımcı) olarak değiştirir, sonra tekrar JUDGE yapar
    partyService.setPartyHostRole(pLeaderSession, createdParty.partyId, 'PLAYER');
    let fetchedParty = partyService.getAllParties().find(p => p.partyId === createdParty.partyId);
    assert.strictEqual(fetchedParty.hostRole, 'PLAYER', 'Rol PLAYER olarak güncellenmelidir.');
    console.log('✓ Lider başarıyla Katılımcı (PLAYER) rolüne geçiş yaptı.');

    partyService.setPartyHostRole(pLeaderSession, createdParty.partyId, 'JUDGE');
    fetchedParty = partyService.getAllParties().find(p => p.partyId === createdParty.partyId);
    assert.strictEqual(fetchedParty.hostRole, 'JUDGE', 'Rol tekrar JUDGE olarak güncellenmelidir.');
    console.log('✓ Lider başarıyla tekrar Jüri (JUDGE) rolüne geçiş yaptı.');

    // 9.3: İkinci oyuncu partiye katılır
    const pMemberSession = await authService.login({ username: 'ModeratorTest', password: 'modpass123' });
    partyService.joinPartyByCode(pMemberSession, createdParty.partyCode);
    fetchedParty = partyService.getAllParties().find(p => p.partyId === createdParty.partyId);
    assert.strictEqual(fetchedParty.members.length, 2, 'Partide 2 üye bulunmalıdır.');
    console.log('✓ İkinci oyuncu partiye başarıyla katıldı.');

    // 9.4: Normal üye maçı başlatamaz
    let throwCount = 0;
    try {
      partyService.startPartyMatch(pMemberSession, createdParty.partyId);
    } catch (e) {
      throwCount++;
    }
    assert.strictEqual(throwCount, 1, 'Lider olmayan oyuncunun maç başlatması engellenmelidir.');
    console.log('✓ Lider olmayan oyuncunun maçı başlatması başarıyla engellendi.');

    // 9.5: Lider maçı ortak sorularla başlatır
    const sampleQuestions = [{ q: 'Soru 1', options: ['A','B','C','D'], answer: 0 }];
    const startedMatch = partyService.startPartyMatch(pLeaderSession, createdParty.partyId, {
      questions: sampleQuestions
    });
    assert.strictEqual(startedMatch.status, 'IN_GAME', 'Parti durumu IN_GAME olmalıdır.');
    assert(startedMatch.matchId, 'Parti için benzersiz matchId üretilmelidir.');
    assert.strictEqual(startedMatch.matchQuestions.length, 1, 'Ortak sorular partiye kaydedilmelidir.');
    console.log('✓ Lider maçı başlattı: Ortak sorular, benzersiz matchId ve IN_GAME durumu tüm katılımcılara sunuldu.');

    // ====================================================
    // TEST 10: E-posta ile Kayıt & Kullanıcı Adı/E-posta ile Giriş
    // ====================================================
    console.log('\n====================================================');
    console.log('TEST 10: E-posta ile Kayıt & Kullanıcı Adı/E-posta ile Giriş');
    console.log('====================================================');

    const emailRegSession = await authService.registerAccount({
      username: 'EmailPlayer',
      email: 'player@example.org',
      password: 'mypassword123',
      passwordConfirm: 'mypassword123',
      minecraftPlayerName: 'Alex'
    });
    assert.strictEqual(emailRegSession.username, 'EmailPlayer');
    assert.strictEqual(emailRegSession.email, 'player@example.org');
    console.log('✓ E-posta ile kullanıcı kaydı başarıyla oluşturuldu.');

    // E-posta ile oturum açma (login with email)
    const loginWithEmailSession = await authService.login({
      username: 'player@example.org',
      password: 'mypassword123'
    });
    assert.strictEqual(loginWithEmailSession.username, 'EmailPlayer');
    console.log('✓ E-posta adresi ile giriş başarıyla doğrulandı.');

    // ====================================================
    // TEST 11: Profil Kullanıcı Adı Değiştirme
    // ====================================================
    console.log('\n====================================================');
    console.log('TEST 11: Profil Kullanıcı Adı Değiştirme');
    console.log('====================================================');

    await userService.changeUsername(loginWithEmailSession, 'RenamedPlayer');
    const renamedUser = userService.getUserByUsername('RenamedPlayer');
    assert(renamedUser, 'Kullanıcı adı RenamedPlayer olarak güncellenmelidir.');
    assert.strictEqual(userService.getUserByUsername('EmailPlayer'), null, 'Eski ad bulunmamalıdır.');
    console.log('✓ Kullanıcı adı başarıyla güncellendi (EmailPlayer -> RenamedPlayer).');

    // ====================================================
    // TEST 12: Bakım Modu (Faz 6) & Günlük Soru Rotasyonu (Faz 5)
    // ====================================================
    console.log('\n====================================================');
    console.log('TEST 12: Bakım Modu & Günlük Soru Rotasyonu');
    console.log('====================================================');

    const maintenanceService = window.MCMServices.maintenanceService;
    const dailyQuestionService = window.MCMServices.dailyQuestionService;

    assert.strictEqual(maintenanceService.isMaintenanceActive(), false, 'Başlangıçta bakım modu kapalı olmalıdır.');
    maintenanceService.setMaintenanceMode(adminSession, true, {
      message: 'Özel test bakımı devam ediyor.'
    });
    assert.strictEqual(maintenanceService.isMaintenanceActive(), true, 'Bakım modu aktif olmalıdır.');
    console.log('✓ Bakım modu ADMIN yetkisiyle başarıyla aktif edildi.');

    maintenanceService.setMaintenanceMode(adminSession, false);
    assert.strictEqual(maintenanceService.isMaintenanceActive(), false, 'Bakım modu kapatılabilmelidir.');
    console.log('✓ Bakım modu ADMIN yetkisiyle başarıyla kapatıldı.');

    const dateKey = dailyQuestionService.getTodayDateKey();
    assert(dateKey && dateKey.includes('-'), 'Türkiye saati bazlı tarih anahtarı dönmelidir.');
    const midnightCountdown = dailyQuestionService.getTimeUntilMidnight();
    assert(midnightCountdown && midnightCountdown.formatted, 'Gece yarısı geri sayımı hesaplanmalıdır.');
    console.log(`✓ Günlük soru tarihi (${dateKey}) ve geri sayım (${midnightCountdown.formatted}) başarıyla hesaplandı.`);

    console.log('\n====================================================');
    console.log('TÜM TESTLER BAŞARIYLA GEÇTİ! 🏆');
    console.log('====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('Test Hatası:', err);
    process.exit(1);
  }
})();
