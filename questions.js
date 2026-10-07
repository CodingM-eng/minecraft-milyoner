/**
 * KİM MİLYONER OLMAK İSTER? — MINECRAFT EDITION
 * Geniş Soru Veritabanı (115 Özgün Türkçe Minecraft Sorusu)
 * Zorluk Seviyeleri:
 * - "easy"   (1–5. Sorular: Kolay)
 * - "medium" (6–10. Sorular: Orta)
 * - "hard"   (11–15. Sorular: Zor)
 *
 * Kategoriler:
 * Mobs, Bloklar, Eşyalar, Crafting, Redstone, Enchantments, Nether, End,
 * Biyomlar, Köylüler, Yapılar, Minecraft mekanikleri, Komutlar, Java Edition,
 * Bedrock Edition, Minecraft tarihçesi, Güncellemeler, Nadir bilgiler
 */

window.QUESTIONS_DB = [
  // =========================================================================
  // KOLAY SORULAR ("easy") — 1-5. Sorular İçin (40 Soru)
  // =========================================================================
  {
    id: 1,
    question: "Minecraft'ta Creeper'ın patlamasını sağlayan temel mekanik nedir?",
    answers: ["Oyuncuya yaklaşması", "Suya girmesi", "Güneş ışığı", "Lava temas etmesi"],
    correctAnswer: 0,
    difficulty: "easy",
    category: "Mobs",
    explanation: "Creeper normal şartlarda oyuncuya 3 blok mesafeye kadar yaklaştığında tıslayarak 1.5 saniye içinde patlar."
  },
  {
    id: 2,
    question: "Minecraft'ta Ender Dragon hangi boyutta bulunur?",
    answers: ["Overworld", "Nether", "End", "Deep Dark"],
    correctAnswer: 2,
    difficulty: "easy",
    category: "End",
    explanation: "Ender Dragon, End boyutunda bulunan ana boss'tur."
  },
  {
    id: 3,
    question: "Minecraft'ta ilk geceyi hızlıca atlatmak ve yeniden doğma noktasını belirlemek için kullanılan eşya hangisidir?",
    answers: ["Kılıç", "Yatak", "Pusula", "Elytra"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Eşyalar",
    explanation: "Yatak (Bed), geceyi uyuyarak sabaha geçirmeyi ve oyuncunun spawn noktasını kaydetmesini sağlar."
  },
  {
    id: 4,
    question: "Ağaç kırdıktan sonra elde edilen 4 adet tahta (Planks) ile üretilen temel üretim bloğu hangisidir?",
    answers: ["Fırın (Furnace)", "Çalışma Masası (Crafting Table)", "Sandık (Chest)", "Örs (Anvil)"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Crafting",
    explanation: "Çalışma Masası (Crafting Table), 2x2 olan envanter üretim alanını 3x3 ızgaraya çıkarır."
  },
  {
    id: 5,
    question: "Köylülerle (Villager) ticaret yaparken kullanılan ana para birimi aşağıdakilerden hangisidir?",
    answers: ["Altın Külçesi", "Elmas (Diamond)", "Zümrüt (Emerald)", "Demir Külçesi"],
    correctAnswer: 2,
    difficulty: "easy",
    category: "Köylüler",
    explanation: "Zümrüt (Emerald), köylülerle alışveriş yapmak için kullanılan standart para birimidir."
  },
  {
    id: 6,
    question: "Aşağıdaki moblardan hangisi gündüzleri güneş ışığına çıktığında yanmaya başlar?",
    answers: ["Creeper", "Örümcek (Spider)", "Zombi (Zombie)", "Enderman"],
    correctAnswer: 2,
    difficulty: "easy",
    category: "Mobs",
    explanation: "Zombiler ve İskeletler gibi yaşayan ölü (undead) moblar doğrudan güneş ışığı altında yanarlar."
  },
  {
    id: 7,
    question: "Kum (Sand) bloğunu fırında (Furnace) pişirdiğimizde hangi blok elde edilir?",
    answers: ["Tuğla (Brick)", "Cam (Glass)", "Düzgün Taş (Smooth Stone)", "Kuvars"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Crafting",
    explanation: "Kum veya Kırmızı Kum fırında eritildiğinde şeffaf Cam (Glass) bloğuna dönüşür."
  },
  {
    id: 8,
    question: "Taş, kömür ve maden cevherlerini kırmak için hangi aleti kullanmak gerekir?",
    answers: ["Balta (Axe)", "Kürek (Shovel)", "Kazma (Pickaxe)", "Çapa (Hoe)"],
    correctAnswer: 2,
    difficulty: "easy",
    category: "Eşyalar",
    explanation: "Kazma (Pickaxe), taş ve cevher bloklarını kırmak için tasarlanmış temel madencilik aletidir."
  },
  {
    id: 9,
    question: "Bir Yatak (Bed) üretmek için 3 adet tahta ile birlikte hangi hayvandan elde edilen 3 malzeme gerekir?",
    answers: ["İnek derisi", "Koyun yünü", "Tavuk tüyü", "Domuz eti"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Crafting",
    explanation: "Yatak yapmak için aynı renkte 3 adet Yün (Wool) ve 3 adet Tahta (Planks) gerekir."
  },
  {
    id: 10,
    question: "Karanlık mağaraları aydınlatmak için 1 Çubuk ve 1 Kömür kullanılarak üretilen eşya nedir?",
    answers: ["Meşale (Torch)", "Ok (Arrow)", "Olta (Fishing Rod)", "Kamp Ateşi"],
    correctAnswer: 0,
    difficulty: "easy",
    category: "Crafting",
    explanation: "1 Çubuk ve 1 Kömür (veya Odun Kömürü) birleştirildiğinde 4 adet Meşale (Torch) verir."
  },
  {
    id: 11,
    question: "Minecraft'ın varsayılan erkek ve kadın başlangıç karakterlerinin isimleri nedir?",
    answers: ["Steve ve Alex", "Notch ve Jeb", "Steve ve Herobrine", "Alex ve Ari"],
    correctAnswer: 0,
    difficulty: "easy",
    category: "Minecraft tarihçesi",
    explanation: "Steve oyunun ilk ikonik karakteridir, Alex ise 1.8 güncellemesiyle ikinci ana karakter olarak eklenmiştir."
  },
  {
    id: 12,
    question: "Vahşi bir Kurdu (Wolf) evcilleştirip sadık bir köpeğe dönüştürmek için ona ne verilmelidir?",
    answers: ["Çiğ Balık", "Kemik (Bone)", "Buğday", "Altın Elma"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Mobs",
    explanation: "İskeletlerden düşen Kemik (Bone) ile kurtlar evcilleştirilebilir."
  },
  {
    id: 13,
    question: "Aşağıdaki bloklardan hangisi altındaki blok kırıldığında yerçekimi etkisiyle aşağı düşer?",
    answers: ["Toprak (Dirt)", "Çakıl (Gravel)", "Kırık Taş (Cobblestone)", "Meşe Kütüğü"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Bloklar",
    explanation: "Kum, Çakıl, Örs, Ejderha Yumurtası ve Çimento blokları yerçekiminden etkilenir."
  },
  {
    id: 14,
    question: "Durağan bir lav kaynağına (Lava source block) su döküldüğünde hangi sert blok oluşur?",
    answers: ["Kırık Taş (Cobblestone)", "Obsidyen (Obsidian)", "Katman Kayası (Bedrock)", "Netherrack"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Minecraft mekanikleri",
    explanation: "Su, akan lava değerse Kırık Taş; durağan lav kaynağına değerse Obsidyen oluşturur."
  },
  {
    id: 15,
    question: "Tekli bir Sandık (Chest) üretmek için Çalışma Masasında kaç adet tahta (Planks) kullanılır?",
    answers: ["4", "6", "8", "9"],
    correctAnswer: 2,
    difficulty: "easy",
    category: "Crafting",
    explanation: "Çalışma masasının ortası boş bırakılarak etrafına 8 adet tahta dizildiğinde Sandık elde edilir."
  },
  {
    id: 16,
    question: "Obsidyen bloğunu kırıp envantere alabilmek için en az hangi kalitede kazma gerekir?",
    answers: ["Demir Kazma", "Altın Kazma", "Elmas Kazma", "Taş Kazma"],
    correctAnswer: 2,
    difficulty: "easy",
    category: "Bloklar",
    explanation: "Obsidyen yalnızca Elmas (Diamond) veya Netherite kazma ile kırıldığında düşer."
  },
  {
    id: 17,
    question: "Enderman'ler aşağıdaki durumlardan hangisinde hasar alır ve hızla ışınlanır?",
    answers: ["Güneş ışığına çıktığında", "Su veya yağmurla temas ettiğinde", "Kum üzerinde yürüdüğünde", "Gece olduğunda"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Mobs",
    explanation: "Enderman suya ve yağmura karşı hassastır; temas ettiğinde can kaybeder ve ışınlanır."
  },
  {
    id: 18,
    question: "Creeper'lar hangi hayvandan korkarak hızla uzaklaşır?",
    answers: ["Kurt (Wolf)", "Kedi ve Ocelot", "Demir Golem", "At"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Mobs",
    explanation: "Creeper'lar kedilerden ve ocelotlardan korkar ve onlardan kaçar."
  },
  {
    id: 19,
    question: "Nether veya End boyutunda bir yatakta uyumaya çalışırsanız ne olur?",
    answers: ["Sabah olur", "Yatak şiddetli bir şekilde patlar", "Oyuncu Overworld'e ışınlanır", "Hiçbir şey olmaz"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Minecraft mekanikleri",
    explanation: "Nether ve End boyutlarında yatak kullanmak TNT'den bile güçlü bir patlamaya yol açar."
  },
  {
    id: 20,
    question: "Koyunlardan onu öldürmeden yün elde etmek için hangi eşya kullanılır?",
    answers: ["Çapa (Hoe)", "Makas (Shears)", "Kılıç", "Olta"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Eşyalar",
    explanation: "2 Demir Külçesi ile yapılan Makas (Shears), koyunları kırparak 1–3 adet yün verir."
  },
  {
    id: 21,
    question: "Hayatta Kalma (Survival) modunda alet kullanmadan kırılamayan ve dünyanın en altında bulunan blok hangisidir?",
    answers: ["Obsidyen", "Katman Kayası (Bedrock)", "Deepslate", "End Taşı"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Bloklar",
    explanation: "Katman Kayası (Bedrock), oyuncunun dünya boşluğuna (Void) düşmesini engelleyen kırılmaz bloktur."
  },
  {
    id: 22,
    question: "Bir Kovayı (Bucket) üretmek için kaç adet Demir Külçesi gerekir?",
    answers: ["2", "3", "4", "5"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Crafting",
    explanation: "V şeklinde yerleştirilen 3 adet Demir Külçesi ile 1 Kova (Bucket) üretilir."
  },
  {
    id: 23,
    question: "İskeletlerin (Skeleton) oyuncuya saldırmak için kullandığı menzilli silah hangisidir?",
    answers: ["Arbalet", "Yay ve Ok", "Üçlü Mızrak (Trident)", "Ateş Topu"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Mobs",
    explanation: "Standart İskeletler yay ve ok kullanarak uzaktan saldırır."
  },
  {
    id: 24,
    question: "Toprağı (Dirt) tarım yapılabilir Ekili Toprağa (Farmland) dönüştürmek için hangi alet kullanılır?",
    answers: ["Kürek (Shovel)", "Çapa (Hoe)", "Balta (Axe)", "Makas"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Eşyalar",
    explanation: "Çapa (Hoe) ile toprağa sağ tıklandığında tohum ekilebilir tarım arazisi oluşur."
  },
  {
    id: 25,
    question: "Nether Portalını ateşleyip aktif hale getirmek için kullanılan klasik eşya hangisidir?",
    answers: ["Meşale", "Çakmaktaş ve Çelik (Flint and Steel)", "Kızıltaş Meşalesi", "Paratoner"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Nether",
    explanation: "Obsidyen çerçevenin içini Çakmaktaş ve Çelik (Flint and Steel) veya Ateş Topu ile yakarak Nether Portalı açılır."
  },
  {
    id: 26,
    question: "Yüksek bir yerden düşerken yere çarpmadan hemen önce altına koyarak düşme hasarını tamamen sıfırlayabildiğimiz ünlü eşya hangisidir?",
    answers: ["Lav Kovası", "Su Kovası (Water Bucket)", "Süt Kovası", "Meşale"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Minecraft mekanikleri",
    explanation: "Water Bucket MLG taktiği ile yere değmeden hemen önce su koymak tüm düşme hasarını iptal eder."
  },
  {
    id: 27,
    question: "Oyuncunun üzerindeki tüm iksir ve zehir etkilerini anında temizleyen içecek hangisidir?",
    answers: ["Su Şişesi", "Süt Kovası (Milk Bucket)", "Bal Şişesi", "Ateş Direnci İksiri"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Eşyalar",
    explanation: "İneklerden sağılan Süt Kovası içildiğinde hem olumlu hem olumsuz tüm durum etkilerini siler."
  },
  {
    id: 28,
    question: "Bambu (Bamboo) ile beslenen ve yalnızca Orman (Jungle) biyomunda yaşayan sevimli hayvan hangisidir?",
    answers: ["Tilki (Fox)", "Panda", "Kutup Ayısı", "Ocelot"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Biyomlar",
    explanation: "Pandalar Bambu Ormanlarında yaşar ve bambu yiyerek çoğalırlar."
  },
  {
    id: 29,
    question: "Demir Golem (Iron Golem) oluşturmak için 1 Oyulmuş Balkabağı ve kaç adet Demir Bloğu gerekir?",
    answers: ["2", "3", "4", "5"],
    correctAnswer: 2,
    difficulty: "easy",
    category: "Mobs",
    explanation: "T şeklinde dizilen 4 Demir Bloğu ve üstüne konulan 1 Balkabağı ile Demir Golem canlanır."
  },
  {
    id: 30,
    question: "Kar Golemi (Snow Golem) yapmak için Balkabağının altına kaç adet Kar Bloğu (Snow Block) koyulmalıdır?",
    answers: ["1", "2", "3", "4"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Mobs",
    explanation: "Üst üste 2 Kar Bloğu ve en üste 1 Oyulmuş Balkabağı koyularak Kar Golemi yapılır."
  },
  {
    id: 31,
    question: "Oyuncunun oyun modunu Yaratıcı (Creative) moda geçirmek için kullanılan temel komut hangisidir?",
    answers: ["/mode creative", "/gamemode creative", "/creative on", "/setmode 1"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Komutlar",
    explanation: "'/gamemode creative' komutu oyuncuyu uçabildiği ve sınırsız kaynağa sahip olduğu Yaratıcı moda geçirir."
  },
  {
    id: 32,
    question: "Minecraft'ı ilk kez tasarlayan ve 'Notch' lakabıyla bilinen İsveçli oyun geliştiricisi kimdir?",
    answers: ["Jens Bergensten", "Markus Persson", "C418", "Agnes Larsson"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Minecraft tarihçesi",
    explanation: "Markus 'Notch' Persson, Mayıs 2009'da Minecraft'ı geliştirmiş ve Mojang şirketini kurmuştur."
  },
  {
    id: 33,
    question: "Deniz altında yaşayan ve elinde Üçlü Mızrak (Trident) taşıyabilen su altı zombisine ne ad verilir?",
    answers: ["Husk", "Drowned (Boğuk)", "Stray", "Guardian"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Mobs",
    explanation: "Drowned (Boğuk), okyanuslarda ve nehirlerde doğan veya suda boğulan zombilerden oluşan su altı mobudur."
  },
  {
    id: 34,
    question: "Kaktüs (Cactus) blokları hangi zemin bloğunun üzerinde büyüyebilir?",
    answers: ["Toprak", "Kum (Sand)", "Çimen Bloğu", "Taş"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Bloklar",
    explanation: "Kaktüs yalnızca Kum veya Kırmızı Kum üzerinde ve yanlarında blok yokken büyüyebilir."
  },
  {
    id: 35,
    question: "Tavukları çiftleştirmek ve peşinizden gelmelerini sağlamak için ne kullanılır?",
    answers: ["Havuç", "Tohumlar (Seeds)", "Elma", "Şeker Kamışı"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Mobs",
    explanation: "Buğday tohumu, pancar tohumu veya karpuz/balkabağı tohumları tavukları beslemek için kullanılır."
  },
  {
    id: 36,
    question: "Kitap (Book) üretmek için 1 adet Deri (Leather) ile birlikte kaç adet Kağıt (Paper) gerekir?",
    answers: ["1", "2", "3", "4"],
    correctAnswer: 2,
    difficulty: "easy",
    category: "Crafting",
    explanation: "Şeker kamışından yapılan 3 Kağıt ve 1 Deri birleştirilerek 1 Kitap üretilir."
  },
  {
    id: 37,
    question: "Elmas Cevheri (Diamond Ore) doğal olarak hangi boyutta bulunur?",
    answers: ["Overworld", "Nether", "End", "Hiçbiri"],
    correctAnswer: 0,
    difficulty: "easy",
    category: "Bloklar",
    explanation: "Elmas cevheri yalnızca Overworld boyutunun derin katmanlarında doğal olarak oluşur."
  },
  {
    id: 38,
    question: "Nether boyutunda Piglin'lerin oyuncuya saldırmaması için hangi malzemeden zırh giyilmelidir?",
    answers: ["Demir", "Elmas", "Altın (Gold)", "Deri"],
    correctAnswer: 2,
    difficulty: "easy",
    category: "Nether",
    explanation: "En az bir parça Altın zırh giymek normal Piglin'lerin oyuncuya düşman olmasını engeller."
  },
  {
    id: 39,
    question: "TNT bloğunu üretmek için Kum ile birlikte hangi malzeme kullanılır?",
    answers: ["Kızıltaş Tozu", "Barut (Gunpowder)", "Blaze Tozu", "Kömür"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Crafting",
    explanation: "5 adet Barut (Gunpowder) ve 4 adet Kum kullanılarak 1 adet TNT üretilir."
  },
  {
    id: 40,
    question: "Parlak Meyveler (Glow Berries) hangi yeraltı mağara biyomunda doğal olarak yetişir?",
    answers: ["Damlataş Mağaraları (Dripstone Caves)", "Yemyeşil Mağaralar (Lush Caves)", "Deep Dark", "Buz Mağaraları"],
    correctAnswer: 1,
    difficulty: "easy",
    category: "Biyomlar",
    explanation: "Glow Berries, Yemyeşil Mağaralar (Lush Caves) biyomunun tavanından sarkan sarmaşıklarda yetişir."
  },

  // =========================================================================
  // ORTA SORULAR ("medium") — 6-10. Sorular İçin (40 Soru)
  // =========================================================================
  {
    id: 41,
    question: "Büyü Masasında (Enchanting Table) maksimum seviye olan 30. seviye büyüleri açmak için etrafına en az kaç adet Kitaplık (Bookshelf) yerleştirilmelidir?",
    answers: ["12", "15", "18", "20"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Enchantments",
    explanation: "Büyü Masasından 1 blok boşluk bırakılarak yerleştirilen 15 adet Kitaplık, 30. seviye büyüleri aktif eder."
  },
  {
    id: 42,
    question: "Köşeleri kullanmadan çalışan en küçük Nether Portalı için en az kaç adet Obsidyen bloğu gerekir?",
    answers: ["8", "10", "12", "14"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Nether",
    explanation: "Tam dikdörtgen çerçeve 14 obsidyen ister ancak 4 köşe bloğu olmadan 10 obsidyen ile portal çalışır."
  },
  {
    id: 43,
    question: "1 adet Netherite Külçesi (Netherite Ingot) üretmek için kaç adet Netherite Hurdası (Scrap) ve kaç adet Altın Külçesi gerekir?",
    answers: ["2 Hurda + 2 Altın", "4 Hurda + 4 Altın", "4 Hurda + 2 Altın", "6 Hurda + 6 Altın"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Nether",
    explanation: "Antik Kalıntıların eritilmesiyle alınan 4 Netherite Hurdası ve 4 Altın Külçesi birleştirilerek 1 Netherite Külçesi yapılır."
  },
  {
    id: 44,
    question: "End Portalını tamamen aktif etmek için çerçeveye toplam kaç adet Ender Gözü (Eye of Ender) yerleştirilmelidir?",
    answers: ["8", "10", "12", "16"],
    correctAnswer: 2,
    difficulty: "medium",
    category: "End",
    explanation: "End Portalı her kenarda 3'er adet olmak üzere toplam 12 End Portal Çerçevesinden oluşur."
  },
  {
    id: 45,
    question: "Toplanan deneyim kürelerini (XP) kullanarak eşyaların dayanıklılığını otomatik olarak onaran hazine büyüsü hangisidir?",
    answers: ["Kırılmazlık (Unbreaking)", "Onarım (Mending)", "Sonsuzluk (Infinity)", "Verimlilik (Efficiency)"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Enchantments",
    explanation: "Onarım (Mending) büyüsü, kazanılan XP puanlarıyla eldeki veya zırhtaki hasarlı eşyayı tamir eder."
  },
  {
    id: 46,
    question: "Bir Kızıltaş (Redstone) kablosu, Yineleyici (Repeater) kullanılmadan sinyali en fazla kaç blok uzağa iletebilir?",
    answers: ["10 blok", "12 blok", "15 blok", "16 blok"],
    correctAnswer: 2,
    difficulty: "medium",
    category: "Redstone",
    explanation: "Redstone sinyal gücü 15'ten başlar ve her blokta 1 azalarak maksimum 15 blok ilerler."
  },
  {
    id: 47,
    question: "Oyuncunun süzülerek uçmasını sağlayan Elytra hangi yapının içinde bulunur?",
    answers: ["Bastion Kalıntısı", "End Gemisi (End Ship)", "Orman Konağı (Woodland Mansion)", "Antik Şehir (Ancient City)"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Yapılar",
    explanation: "Elytra, End Şehirlerinin yanında havada asılı duran End Gemilerinin (End Ship) içindeki eşya çerçevesinde bulunur."
  },
  {
    id: 48,
    question: "Deep Dark biyomunda ve Antik Şehirlerde ortaya çıkan, tamamen kör olduğu için ses ve titreşimlerle avlanan güçlü mob hangisidir?",
    answers: ["Ravager", "Warden", "Wither", "Elder Guardian"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Mobs",
    explanation: "Warden 500 can puanına (250 kalp) sahiptir ve Sculk Çığlıkçısı (Shrieker) tarafından 4. uyarıda çağrılır."
  },
  {
    id: 49,
    question: "Wither boss'unu çağırmak için 3 adet Wither İskeleti Kafatası ile birlikte 4 adet hangi blok kullanılmalıdır?",
    answers: ["Obsidyen", "Ruh Kumu veya Ruh Toprağı", "Netherrack", "Magma Bloğu"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Nether",
    explanation: "T şeklinde yerleştirilen 4 Ruh Kumu (Soul Sand) veya Ruh Toprağı (Soul Soil) üzerine 3 kafatası konularak Wither çağrılır."
  },
  {
    id: 50,
    question: "Creeper hangi mob tarafından öldürüldüğünde yere Müzik Diski (Music Disc) düşürür?",
    answers: ["Yağmacı (Pillager)", "İskelet (Skeleton) veya Stray", "Cadı (Witch)", "Blaze"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Minecraft mekanikleri",
    explanation: "Bir İskelet veya Stray'in oku Creeper'a son vuruşu yaparsa Creeper rastgele bir Müzik Diski düşürür."
  },
  {
    id: 51,
    question: "Zombi Köylüyü (Zombie Villager) iyileştirip normal köylüye dönüştürmek için Zayıflık İksiri attıktan sonra ona ne yedirilmelidir?",
    answers: ["Altın Havuç", "Altın Elma (Golden Apple)", "Parlayan Karpuz", "Zümrüt"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Köylüler",
    explanation: "Patlayıcı Zayıflık İksiri (Splash Potion of Weakness) ve ardından normal bir Altın Elma verilerek Zombi Köylü iyileştirilir."
  },
  {
    id: 52,
    question: "İşsiz bir köylüyü 'Kütüphaneci' (Librarian) mesleğine geçirmek için yanına hangi meslek bloğu konulmalıdır?",
    answers: ["Kitaplık (Bookshelf)", "Kürsü (Lectern)", "Haritacı Masası", "Büyü Masası"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Köylüler",
    explanation: "Kürsü (Lectern), köylünün Kütüphaneci olmasını ve büyülü kitap ticareti yapmasını sağlar."
  },
  {
    id: 53,
    question: "Oyuncuyu ölümcül bir darbeden kurtaran 'Ölümsüzlük Totemi' (Totem of Undying) hangi düşman mobdan düşer?",
    answers: ["Vindicator (İntikamcı)", "Evoker (Uyandırıcı)", "Cadı (Witch)", "Piglin Brute"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Eşyalar",
    explanation: "Ölümsüzlük Totemi yalnızca Baskınlarda (Raid) ve Orman Konaklarında bulunan Evoker tarafından düşürülür."
  },
  {
    id: 54,
    question: "İksir Tezgahını (Brewing Stand) çalıştırmak için yakıt yuvasına hangi malzeme konulmalıdır?",
    answers: ["Kızıltaş Tozu", "Blaze Tozu (Blaze Powder)", "Işıktaşı Tozu", "Barut"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Crafting",
    explanation: "İksir Tezgahları yakıt olarak yalnızca Blaze Çubuğundan üretilen Blaze Tozunu kullanır."
  },
  {
    id: 55,
    question: "Maden cevherlerini, camı ve buz bloklarını kırıldığında kendi blok haliyle düşmesini sağlayan büyü hangisidir?",
    answers: ["Servet (Fortune)", "İpeksi Dokunuş (Silk Touch)", "Verimlilik (Efficiency)", "Ganimet (Looting)"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Enchantments",
    explanation: "İpeksi Dokunuş (Silk Touch) büyüsü, blokların işlenmemiş ham halleriyle alınmasını sağlar."
  },
  {
    id: 56,
    question: "Oyuncu üst üste en az kaç oyun günü boyunca hiç uyumazsa geceleri gökyüzünde Phantom'lar doğmaya başlar?",
    answers: ["2 gün", "3 gün", "5 gün", "7 gün"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Mobs",
    explanation: "Oyuncu 3 oyun günü (gerçek zamanla 1 saat) boyunca yatağa girmezse geceleri Phantom'lar ortaya çıkar."
  },
  {
    id: 57,
    question: "Fırtınalı havada bir Domuza (Pig) yıldırım çarparsa hangi moba dönüşür?",
    answers: ["Hoglin", "Zombileşmiş Piglin (Zombified Piglin)", "Piglin Brute", "Wither İskeleti"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Minecraft mekanikleri",
    explanation: "Yıldırım çarpan domuzlar Zombileşmiş Piglin'e dönüşür."
  },
  {
    id: 58,
    question: "İsim Etiketi (Name Tag) ile bir koyuna hangi isim verilirse yünü sürekli gökkuşağı renklerinde değişir?",
    answers: ["Dinnerbone", "jeb_", "Johnny", "Toast"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Nadir bilgiler",
    explanation: "Baş geliştirici Jens Bergensten'in lakabı olan 'jeb_' ismi koyunun yününü RGB renk döngüsüne sokar."
  },
  {
    id: 59,
    question: "Hangi biyomda geceleri ve mağaralarda bile hiçbir düşman (hostile) mob doğal olarak doğmaz?",
    answers: ["Kiraz Çiçeği Korusu (Cherry Grove)", "Mantar Adası (Mushroom Fields)", "Çiçek Ormanı", "Sıcak Okyanus"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Biyomlar",
    explanation: "Mantar Adası (Mushroom Fields) biyomunda normal düşman moblar doğal olarak spawn olmaz."
  },
  {
    id: 60,
    question: "Minecraft 1.21 (Tricky Trials) güncellemesiyle eklenen ve yüksekten düşerken vurulduğunda devasa hasar veren yeni silah hangisidir?",
    answers: ["Kargı (Halberd)", "Gürz (Mace)", "Bumerang", "Ağır Çekiç"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Güncellemeler",
    explanation: "Breeze Çubuğu ve Ağır Çekirdek (Heavy Core) ile yapılan Gürz (Mace), düşülen yüksekliğe göre artan hasar verir."
  },
  {
    id: 61,
    question: "Fırında (Furnace) tek bir kullanımla tam 100 adet eşya pişirebilen en uzun süreli yakıt hangisidir?",
    answers: ["Kömür Bloğu", "Lav Kovası (Lava Bucket)", "Kurutulmuş Su Yosunu Bloğu", "Blaze Çubuğu"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Minecraft mekanikleri",
    explanation: "Lav Kovası 1000 saniye boyunca yanarak 100 eşyayı eritebilir (Kömür Bloğu ise 80 eşya pişirir)."
  },
  {
    id: 62,
    question: "Nether'de hangi blok kırıldığında yakındaki Piglin'ler altın zırh giyseniz bile size anında saldırır?",
    answers: ["Netherrack", "Kuvars Cevheri", "Yaldızlı Karataş / Altın Cevheri ( ve Sandıklar)", "Ruh Kumu"],
    correctAnswer: 2,
    difficulty: "medium",
    category: "Nether",
    explanation: "Piglin'lerin yanında Altın içeren blokları kırmak veya sandık/varil/shulker kutusu açmak onları kızdırır."
  },
  {
    id: 63,
    question: "Bir İsim Etiketine (Name Tag) 'Dinnerbone' veya 'Grumm' yazıp bir canlıya verirseniz ne olur?",
    answers: ["Canlı görünmez olur", "Canlı baş aşağı (ters) döner", "Canlı dev boyutlara ulaşır", "Canlı rengini değiştirir"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Nadir bilgiler",
    explanation: "Dinnerbone veya Grumm ismi verilen tüm moblar baş aşağı ters döner."
  },
  {
    id: 64,
    question: "Okyanus Anıtlarında (Ocean Monument) yaşayan ve oyuncuya 'Madencilik Yorgunluğu III' (Mining Fatigue) etkisi veren mini-boss hangisidir?",
    answers: ["Guardian", "Elder Guardian (Yaşlı Muhafız)", "Warden", "Drowned"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Yapılar",
    explanation: "Her Okyanus Anıtında 3 adet Elder Guardian bulunur ve duvarları kırmayı zorlaştıran Madencilik Yorgunluğu verir."
  },
  {
    id: 65,
    question: "Aşağıdaki büyülerden (Enchantment) hangi ikisi normal şartlarda aynı Yay (Bow) üzerinde bir arada bulunamaz?",
    answers: ["Güç ve Alev", "Sonsuzluk (Infinity) ve Onarım (Mending)", "Yumruk ve Kırılmazlık", "Güç ve Sonsuzluk"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Enchantments",
    explanation: "Sonsuzluk (Infinity) ve Onarım (Mending) birbirine zıt büyülerdir ve aynı yaya basılamaz."
  },
  {
    id: 66,
    question: "Gece Görüşü İksiri (Potion of Night Vision) hazırlamak için Garip İksire (Awkward Potion) hangi malzeme eklenir?",
    answers: ["Parlayan Karpuz Dilimi", "Altın Havuç (Golden Carrot)", "Örümcek Gözü", "Magma Kremi"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Crafting",
    explanation: "Garip İksire Altın Havuç eklendiğinde Gece Görüşü İksiri elde edilir."
  },
  {
    id: 67,
    question: "Bir Fener (Beacon) bloğu üretmek için 5 Cam ve 3 Obsidyen ile birlikte hangi nadir eşya gerekir?",
    answers: ["Ender Gözü", "Nether Yıldızı (Nether Star)", "Ejderha Nefesi", "Denizin Kalbi"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Crafting",
    explanation: "Wither boss'unu yenerek elde edilen Nether Yıldızı (Nether Star), Fener üretiminin merkez malzemesidir."
  },
  {
    id: 68,
    question: "Nether'de lav göllerinin üzerinde yürüyebilen Strider'ı yönlendirmek için hangi olta kullanılır?",
    answers: ["Havuçlu Olta", "Çarpık Mantarlı Olta (Warped Fungus on a Stick)", "Kızıl Mantarlı Olta", "Altın Elmalı Olta"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Nether",
    explanation: "Strider'lar Çarpık Mantarı (Warped Fungus) çok sever ve Çarpık Mantarlı Olta ile sürülür."
  },
  {
    id: 69,
    question: "End boyutunda Enderman'lerin oyuncuya saldırmadan yüzlerine bakabilmesini sağlayan kafalık bloğu hangisidir?",
    answers: ["Elmas Miğfer", "Oyulmuş Balkabağı (Carved Pumpkin)", "Kaplumbağa Kabuğu", "Altın Miğfer"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "End",
    explanation: "Kafaya Oyulmuş Balkabağı takıldığında Enderman'lerle göz teması kurulsa bile kışkırtılmazlar."
  },
  {
    id: 70,
    question: "Kızıltaş (Redstone) sistemlerinde ışığın gücünü algılayarak elektrik sinyali üreten blok hangisidir?",
    answers: ["Gözlemci (Observer)", "Gün Işığı Algılayıcısı (Daylight Detector)", "Hedef Bloğu", "Kızıltaş Lambası"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Redstone",
    explanation: "Gün Işığı Algılayıcısı güneş ışığına (veya ters çevrildiğinde gece karanlığına) göre Redstone sinyali verir."
  },
  {
    id: 71,
    question: "Bir bloktaki durum değişikliğini (örneğin ekinin büyümesini veya bloğun kırılmasını) algılayıp anlık 1-tick sinyal veren Redstone bloğu hangisidir?",
    answers: ["Karşılaştırıcı (Comparator)", "Gözlemci (Observer)", "Bırakıcı (Dropper)", "Fırlatıcı (Dispenser)"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Redstone",
    explanation: "Gözlemci (Observer), ön yüzündeki blok güncellemelerini tespit edip arkasından kısa bir Redstone darbesi gönderir."
  },
  {
    id: 72,
    question: "Oyuncu öldüğünde envanterindeki eşyaların ve seviyelerin düşmemesini sağlayan oyun kuralı komutu hangisidir?",
    answers: ["/gamerule keepInventory true", "/gamerule saveItems true", "/gamerule noDrop true", "/keepinventory 1"],
    correctAnswer: 0,
    difficulty: "medium",
    category: "Komutlar",
    explanation: "'/gamerule keepInventory true' komutu ölüm sonrasında tüm eşyaların oyuncuda kalmasını sağlar."
  },
  {
    id: 73,
    question: "Kırıldığında içindeki eşyaları kaybetmeden taşınabilen 'Shulker Kutusu' (Shulker Box) üretmek için 1 Sandık ve kaç adet Shulker Kabuğu gerekir?",
    answers: ["1", "2", "4", "8"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "End",
    explanation: "End Şehirlerindeki Shulker'lardan düşen 2 adet Shulker Kabuğu ve 1 Sandık ile Shulker Kutusu yapılır."
  },
  {
    id: 74,
    question: "Bir Creeper'a yıldırım çarptığında neye dönüşür?",
    answers: ["Wither Creeper", "Şarjlı Creeper (Charged Creeper)", "Mega Creeper", "Patlayarak yok olur"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Mobs",
    explanation: "Yıldırım çarpan Creeper, mavi elektrik kalkanına sahip çok daha güçlü bir Şarjlı Creeper'a dönüşür."
  },
  {
    id: 75,
    question: "Üçlü Mızrağa (Trident) basılan ve yağmurlu/fırtınalı havada oyuncunun mızrakla birlikte havada uçmasını sağlayan büyü hangisidir?",
    answers: ["Sadakat (Loyalty)", "Girdap (Riptide)", "Yıldırım Yönlendirici (Channeling)", "Şişleme (Impaling)"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Enchantments",
    explanation: "Girdap (Riptide) büyüsü, oyuncu suyun içindeyken veya yağmur altında mızrağı fırlattığında oyuncuyu ileri fırlatır."
  },
  {
    id: 76,
    question: "Hangi köylü mesleği Çubuk (Stick) karşılığında Zümrüt vererek oyuncular arasında en popüler başlangıç ticaretlerinden birini sunar?",
    answers: ["Demirci (Armorer)", "Okçu (Fletcher)", "Kasap (Butcher)", "Taşçı (Mason)"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Köylüler",
    explanation: "Okçuluk Masası (Fletching Table) kullanan Okçu (Fletcher), 32 Çubuk karşılığında 1 Zümrüt verir."
  },
  {
    id: 77,
    question: "Antik Şehirlerde (Ancient City) zemini kaplayan ve üzerine basıldığında sesleri emerek Warden'ı uyandırmayan blok hangisidir?",
    answers: ["Deepslate", "Yün (Wool)", "Ruh Kumu", "Obsidyen"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Yapılar",
    explanation: "Yün (Wool) ve Halı blokları ses titreşimlerini engellediği için Sculk Sensörleri tarafından algılanmaz."
  },
  {
    id: 78,
    question: "Çöl Tapınaklarının (Desert Pyramid) gizli alt odasında bulunan 4 sandığın tam ortasındaki tuzak ne ile tetiklenir?",
    answers: ["Tuzak Kancası (Tripwire)", "Taş Basınç Plakası (Stone Pressure Plate)", "Gözlemci", "Dedektör Ray"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Yapılar",
    explanation: "Hazine odasının tam ortasındaki Taş Basınç Plakası, altındaki 9 adet TNT'yi ateşler."
  },
  {
    id: 79,
    question: "Buz (Ice) bloklarından oluşan teknoyollarında (Ice Highway) tekneler neden çok yüksek hızlara ulaşır?",
    answers: ["Tekneler suda yüzdüğü için", "Buzun kayganlık (slipperiness) katsayısı sürtünmeyi azalttığı için", "Rüzgar etkisi yüzünden", "Redstone gücü verdiği için"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Minecraft mekanikleri",
    explanation: "Paketli Buz ve Mavi Buz yüksek kayganlık değerine sahip olduğu için tekneler üzerinde saniyede 40–72 blok hıza çıkar."
  },
  {
    id: 80,
    question: "Minecraft'ta bir Pusula (Compass) üzerine hangi bloğa sağ tıklanırsa pusula artık dünya doğma noktası yerine o bloğu gösterir?",
    answers: ["Fener (Beacon)", "Mıknatıs Taşı (Lodestone)", "Ametist Bloğu", "Kuvars Sütunu"],
    correctAnswer: 1,
    difficulty: "medium",
    category: "Eşyalar",
    explanation: "1 Netherite Külçesi ve 8 Oyulmuş Taş Tuğla ile yapılan Mıknatıs Taşı (Lodestone), pusulayı kendisine kilitler."
  },

  // =========================================================================
  // ZOR SORULAR ("hard") — 11-15. Sorular İçin (35 Soru)
  // =========================================================================
  {
    id: 81,
    question: "Tam güçte (Seviye 4) çalışan bir Fener (Beacon) piramidi inşa etmek için tabanda toplam kaç adet maden bloğu (Demir, Altın, Zümrüt vb.) gerekir?",
    answers: ["144", "164", "184", "200"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Yapılar",
    explanation: "4 katmanlı piramit: 9x9 (81) + 7x7 (49) + 5x5 (25) + 3x3 (9) = toplam 164 adet blok gerektirir."
  },
  {
    id: 82,
    question: "Nether boyutunda yatay olarak (X veya Z ekseninde) gidilen 1 blok, Overworld boyutunda kaç bloğa karşılık gelir?",
    answers: ["4 blok", "8 blok", "10 blok", "16 blok"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Nether",
    explanation: "Nether ve Overworld arasındaki koordinat ölçeği 1:8'dir. Nether'de 1 blok ilerlemek Overworld'de 8 blok demektir."
  },
  {
    id: 83,
    question: "Minecraft 1.18 (Caves & Cliffs Part II) güncellemesinden itibaren Overworld dünyasının minimum ve maksimum inşa yüksekliği (Y koordinatı) nedir?",
    answers: ["0 ile 256 arası", "-64 ile 320 arası", "-128 ile 256 arası", "-64 ile 512 arası"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Güncellemeler",
    explanation: "1.18 ile dünya tabanı Y=-64'e indirilmiş ve tavan sınırı Y=320'ye çıkarılmıştır (toplam 384 blok yükseklik)."
  },
  {
    id: 84,
    question: "Netherite üretimi için gereken 'Antik Kalıntı' (Ancient Debris) Nether'de en yoğun olarak hangi Y yüksekliğinde bulunur?",
    answers: ["Y = 7", "Y = 15", "Y = 32", "Y = 48"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Nether",
    explanation: "Antik Kalıntı (Ancient Debris) en yüksek olasılıkla Y=15 seviyesinde oluşur."
  },
  {
    id: 85,
    question: "Standart veya Yapışkan bir Piston (Piston) tek seferde en fazla kaç adet bloğu ileri itebilir?",
    answers: ["8 blok", "10 blok", "12 blok", "15 blok"],
    correctAnswer: 2,
    difficulty: "hard",
    category: "Redstone",
    explanation: "Pistonların itme sınırı 12 bloktur; önünde 13 veya daha fazla blok varsa piston açılmaz."
  },
  {
    id: 86,
    question: "Java Edition ve Bedrock Edition arasındaki savaş (Combat) mekaniği farklarından hangisi doğrudur?",
    answers: ["Java Edition'da Kalkan (Shield) yoktur", "Bedrock Edition'da silah bekleme süresi (Attack Cooldown) yoktur", "Bedrock Edition'da baltalar kılıçtan daha fazla hasar verir", "Java Edition'da kritik vuruş yapılamaz"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Bedrock Edition",
    explanation: "1.9 Combat Update yalnızca Java Edition'a geldiği için Bedrock Edition'da hala bekleme süresiz (cooldown-suz) saldırı mekaniği bulunur."
  },
  {
    id: 87,
    question: "Hangi düşman moba 'Johnny' yazılı bir İsim Etiketi (Name Tag) takıldığında etrafındaki neredeyse tüm canlılara acımasızca saldırır?",
    answers: ["Yağmacı (Pillager)", "İntikamcı (Vindicator)", "Piglin Brute", "Evoker"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Nadir bilgiler",
    explanation: "'The Shining' filmine gönderme olarak Vindicator'a 'Johnny' ismi verildiğinde diğer Illager'lar hariç gördüğü her canlıya saldırır."
  },
  {
    id: 88,
    question: "Su altında tam güçte çalışan bir 'Oluk' (Conduit) yapısı kurmak için etrafındaki çerçevede en az kaç adet Prizmarin/Deniz Feneri bloğu bulunmalıdır?",
    answers: ["16", "32", "42", "64"],
    correctAnswer: 2,
    difficulty: "hard",
    category: "Yapılar",
    explanation: "Conduit 16 blokla çalışmaya başlar ancak maksimum menzil (96 blok) ve düşmanlara hasar verme özelliği için 42 blok gerekir."
  },
  {
    id: 89,
    question: "Çıkarma (Subtraction) modundaki bir Redstone Karşılaştırıcısına (Comparator) arkadan 14, yandan ise 6 gücünde sinyal gelirse çıkış gücü kaç olur?",
    answers: ["6", "8", "14", "0"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Redstone",
    explanation: "Ön meşalesi yanan (çıkarma modundaki) Karşılaştırıcı, arka girişten (14) yan girişi (6) çıkarır: 14 - 6 = 8."
  },
  {
    id: 90,
    question: "Minecraft'ta doğal olarak Pembe Koyun (Pink Sheep) doğma ihtimali yaklaşık yüzde kaçtır?",
    answers: ["%1.5", "%0.5", "%0.164", "%0.01"],
    correctAnswer: 2,
    difficulty: "hard",
    category: "Nadir bilgiler",
    explanation: "Doğada kendiliğinden pembe yünlü bir koyun doğma ihtimali tam olarak %0.164'tür (yaklaşık 610 koyunda 1)."
  },
  {
    id: 91,
    question: "Aksolotlları (Axolotl) çiftleştirirken en nadir renk olan Mavi Aksolotlun doğma şansı nedir?",
    answers: ["1 / 100", "1 / 500", "1 / 1200", "1 / 5000"],
    correctAnswer: 2,
    difficulty: "hard",
    category: "Nadir bilgiler",
    explanation: "Pokemon'daki Mudkip'e gönderme olarak Mavi Aksolotl doğma şansı 1200'de 1'dir (%0.083)."
  },
  {
    id: 92,
    question: "Bir End Portalında tüm 12 çerçevenin de dünya oluşurken kendiliğinden Ender Gözü takılı olarak gelme ihtimali nedir?",
    answers: ["1 milyonda 1", "1 milyarda 1", "1 trilyonda 1 (10⁻¹²)", "İmkansızdır"],
    correctAnswer: 2,
    difficulty: "hard",
    category: "Nadir bilgiler",
    explanation: "Her çerçevenin göz içerme şansı %10 (0.1) olduğundan 12'sinin birden dolu gelme olasılığı 0.1¹² = 1 trilyonda 1'dir."
  },
  {
    id: 93,
    question: "Java Edition'ı Bedrock Edition'dan ayıran en ünlü Redstone Piston mekaniği aşağıdakilerden hangisidir?",
    answers: ["Bedrock'ta Yapışkan Piston olmaması", "Java Edition'da Quasi-Connectivity (QC) ve 1-tick blok bırakma mekaniğinin bulunması", "Java Edition'da sandıkların pistonla itilebilmesi", "Bedrock Edition'da Gözlemci bloğunun olmaması"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Java Edition",
    explanation: "Java Edition'da pistonlar çapraz/üst bloktan güç alabilir (Quasi-Connectivity) ve 1-tick darbeyle bloğu yerinde bırakabilir."
  },
  {
    id: 94,
    question: "Minecraft oyun motoru normal şartlarda saniyede kaç 'Oyun Tik'i (Game Tick / TPS) hızında çalışır?",
    answers: ["10 TPS", "20 TPS", "30 TPS", "60 TPS"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Minecraft mekanikleri",
    explanation: "Minecraft'ın oyun döngüsü saniyede 20 Game Tick (1 tick = 0.05 saniye), Redstone sistemi ise 10 Redstone Tick hızında işler."
  },
  {
    id: 95,
    question: "Hayatta Kalma (Survival) modunda Örs (Anvil) üzerinde bir eşyayı onarırken veya büyülerken işlem bedeli kaç seviyeye ulaştığında 'Çok Pahalı!' (Too Expensive!) hatası verir?",
    answers: ["30 seviye", "35 seviye", "40 seviye (en fazla 39'a izin verilir)", "50 seviye"],
    correctAnswer: 2,
    difficulty: "hard",
    category: "Minecraft mekanikleri",
    explanation: "Survival modunda Örs işlemi 40 veya daha fazla XP seviyesi istediğinde 'Too Expensive!' yazar; maksimum izin verilen sınır 39'dur."
  },
  {
    id: 96,
    question: "Bir Shulker Kutusunun (Shulker Box) tüm yuvaları 64'lük yığınlanabilen eşyalarla tamamen doldurulursa tek bir kutu kaç adet eşya taşır?",
    answers: ["1.024", "1.728", "2.048", "3.456"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Eşyalar",
    explanation: "Shulker Kutusu 27 slota sahiptir: 27 × 64 = 1.728 adet eşya."
  },
  {
    id: 97,
    question: "Pantolona (Leggings) basılabilen ve oyuncunun eğilerek (Sneaking) çok daha hızlı yürümesini sağlayan 'Çevik Gizlilik' (Swift Sneak) büyüsü yalnızca hangi yapıda bulunur?",
    answers: ["Bastion Kalıntısı", "Antik Şehir (Ancient City)", "End Şehri", "Deneme Odaları (Trial Chambers)"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Enchantments",
    explanation: "Swift Sneak büyüsü yalnızca Deep Dark biyomundaki Antik Şehir (Ancient City) sandıklarından çıkar."
  },
  {
    id: 98,
    question: "Elmas zırh ve aletleri Demirci Masasında (Smithing Table) Netherite'e yükseltmek için gereken 'Netherite Yükseltme Şablonu' hangi yapıdan bulunur?",
    answers: ["Nether Kalesi (Nether Fortress)", "Bastion Kalıntısı (Bastion Remnant)", "Yıkık Portal", "End Gemisi"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Nether",
    explanation: "1.20 güncellemesinden itibaren Netherite Upgrade Smithing Template yalnızca Bastion Remnant sandıklarında bulunur."
  },
  {
    id: 99,
    question: "Minecraft 1.21 ile eklenen otomatik üretim bloğu 'Üretici' (Crafter), tüm 9 yuvası kilitlendiğinde (devre dışı bırakıldığında) Redstone Karşılaştırıcısına kaç gücünde sinyal verir?",
    answers: ["0", "9", "12", "15"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Redstone",
    explanation: "Crafter bloğunda dolu veya kilitlenmiş her yuva Karşılaştırıcıya 1 sinyal gücü verir; 9 yuvanın tamamı kilitliyse çıkış 9 olur."
  },
  {
    id: 100,
    question: "Katman Kayası (Bedrock) bloğunun oyun kodlarındaki patlama direnci (Blast Resistance) değeri kaçtır?",
    answers: ["1.200", "36.000", "3.600.000", "999.999.999"],
    correctAnswer: 2,
    difficulty: "hard",
    category: "Bloklar",
    explanation: "Obsidyenin patlama direnci 1.200 iken, Bedrock ve End Portal Çerçevesinin patlama direnci 3.600.000'dir."
  },
  {
    id: 101,
    question: "Java Edition'da bir dünyanın merkezinden (0, 0) itibaren Dünya Sınırı (World Border) her yönde yaklaşık kaç milyon blok uzaklıktadır?",
    answers: ["1.000.000 blok", "12.550.821 blok", "29.999.984 blok (≈30 milyon)", "64.000.000 blok"],
    correctAnswer: 2,
    difficulty: "hard",
    category: "Java Edition",
    explanation: "Modern Java Edition'da Dünya Sınırı X ve Z koordinatlarında ±29.999.984 noktasında yer alır."
  },
  {
    id: 102,
    question: "Minecraft'ın Mayıs 2009'da Notch tarafından geliştirilen en ilk prototip sürümünün adı neydi?",
    answers: ["Block World", "Cave Game", "Order of the Stone", "Infiniminer 2"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Minecraft tarihçesi",
    explanation: "Notch'un geliştirdiği ilk teknoloji demosunun adı 'Cave Game' idi, kısa süre sonra adı Minecraft olarak değiştirildi."
  },
  {
    id: 103,
    question: "Minecraft 1.20.3 güncellemesiyle eklenen ve oyundaki zaman/tick akışını dondurmayı veya hızlandırmayı sağlayan komut hangisidir?",
    answers: ["/time freeze", "/tick", "/gamerule tickSpeed", "/world speed"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Komutlar",
    explanation: "'/tick freeze' ve '/tick rate <değer>' komutları oyunun çalışma hızını kontrol etmeye ve dondurmaya olanak tanır."
  },
  {
    id: 104,
    question: "Şarjlı bir Creeper'ın (Charged Creeper) patlamasıyla Wither İskeleti öldürülürse yüzde kaç ihtimalle Wither İskeleti Kafatası düşer?",
    answers: ["%2.5", "%5.5", "%50", "%100"],
    correctAnswer: 3,
    difficulty: "hard",
    category: "Minecraft mekanikleri",
    explanation: "Normalde %2.5 (Looting III ile %5.5) olan kafatası düşme şansı, Şarjlı Creeper patlamasıyla öldürüldüğünde %100'dür."
  },
  {
    id: 105,
    question: "Orman Konağı (Woodland Mansion) haritasını satın alabilmek için Haritacı (Cartographer) köylüyü en az hangi ticaret seviyesine yükseltmek gerekir?",
    answers: ["Acemi (Novice - Seviye 1)", "Çırak (Apprentice - Seviye 2)", "Kalfa (Journeyman - Seviye 3)", "Usta (Master - Seviye 5)"],
    correctAnswer: 2,
    difficulty: "hard",
    category: "Köylüler",
    explanation: "Haritacı köylü 2. seviyede Okyanus Anıtı haritası, 3. seviyede (Kalfa / Journeyman) ise Orman Konağı haritası satar."
  },
  {
    id: 106,
    question: "Tavşanlara hangi isim etiketi (Name Tag) verildiğinde özel siyah-beyaz alacalı bir görünüme (Easter Egg) bürünür?",
    answers: ["jeb_", "Toast", "Killer", "Bugs"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Nadir bilgiler",
    explanation: "Bir oyuncunun kaybolan tavşanı anısına oyuna eklenen 'Toast' etiketi, tavşana özel siyah-beyaz kürk deseni verir."
  },
  {
    id: 107,
    question: "Deneme Odaları (Trial Chambers) yapısındaki 'Uğursuz Kasa'dan (Ominous Vault) Gürz (Mace) yapmak için gereken 'Ağır Çekirdek' (Heavy Core) çıkma ihtimali yüzde kaçtır?",
    answers: ["%1.2", "%7.5", "%25", "%50"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Yapılar",
    explanation: "Ominous Trial Key ile açılan Uğursuz Kasadan Heavy Core düşme olasılığı %7.5'tir."
  },
  {
    id: 108,
    question: "Ejderha Yumurtasına (Dragon Egg) sağ veya sol tıklandığında yatay olarak en fazla kaç blok uzağa ışınlanabilir?",
    answers: ["7 blok", "15 blok", "32 blok", "64 blok"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "End",
    explanation: "Ejderha Yumurtası dikeyde ±7 blok, yatayda ise ±15 blok mesafedeki rastgele bir boşluğa ışınlanır."
  },
  {
    id: 109,
    question: "Belirli bir bölgedeki blokları başka bir bloğa dönüştürmek veya alanı blokla doldurmak için kullanılan komut hangisidir?",
    answers: ["/setblock", "/fill", "/clone", "/replace"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Komutlar",
    explanation: "'/setblock' tek bir bloğu değiştirirken, '/fill <x1 y1 z1> <x2 y2 z2> <blok>' komutu seçili 3 boyutlu hacmi doldurur."
  },
  {
    id: 110,
    question: "Bedrock Edition'da zırh askılarının (Armor Stand) Java Edition'dan farklı olarak varsayılan şekilde sahip olduğu özellik nedir?",
    answers: ["Uçabilmeleri", "Kollarının olması ve kızıltaş sinyaliyle poz değiştirebilmeleri", "Hasar almamaları", "Envanter taşıyabilmeleri"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Bedrock Edition",
    explanation: "Bedrock Edition'da Zırh Askılarının kolları vardır ve Redstone sinyal gücüne göre 13 farklı dans/duruş pozuna girebilir."
  },
  {
    id: 111,
    question: "Bir çalışma masasında 'Gözlemci' (Observer) üretmek için 6 Kırık Taş ve 2 Kızıltaş Tozu ile birlikte hangi Nether malzemesi gerekir?",
    answers: ["1 Işıktaşı Tozu", "1 Nether Kuvarsı (Nether Quartz)", "1 Magma Kremi", "1 Ruh Kumu"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Crafting",
    explanation: "Gözlemci üretimi için ön yüze 1 adet Nether Kuvarsı, arkaya 2 Kızıltaş Tozu ve alt-üst sıralara 6 Kırık Taş dizilir."
  },
  {
    id: 112,
    question: "Overworld'de doğal olarak oluşan bir 'Büyük Eğreltiotu' veya 'Uzun Çimen' içinden hangi eşya kesinlikle düşmez?",
    answers: ["Buğday Tohumu", "Patates", "Hiçbir şey", "Tohum"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Bloklar",
    explanation: "Çimenler yalnızca Buğday Tohumu düşürür; Patates ve Havuç ise zombilerden veya köy tarlalarından elde edilir."
  },
  {
    id: 113,
    question: "Bir 'Büyüleyici Altın Elma' (Enchanted Golden Apple / Notch Apple) hangi güncellemeden itibaren artık çalışma masasında 8 Altın Bloğu ile üretilememektedir?",
    answers: ["1.7.2", "1.9 (Combat Update)", "1.14 (Village & Pillage)", "1.16 (Nether Update)"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Güncellemeler",
    explanation: "1.9 güncellemesiyle Büyülü Altın Elmanın üretim tarifi kaldırılmış ve yalnızca sandık ganimeti (loot) yapılmıştır."
  },
  {
    id: 114,
    question: "Hangi biyomda suyun ve gökyüzünün rengi kendine has morumsu/açık mavi tonda olup yalnızca Kiraz Ağaçları (Cherry Blossom) yetişir?",
    answers: ["Meadow (Çayır)", "Cherry Grove (Kiraz Çiçeği Korusu)", "Flower Forest", "Sparse Jungle"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Biyomlar",
    explanation: "1.20 (Trails & Tales) güncellemesiyle eklenen Cherry Grove biyomu pembe yaprak parçacıkları ve özel pembe odun setiyle ünlüdür."
  },
  {
    id: 115,
    question: "Minecraft'ta 'Buraya Nasıl Geldik?' (How Did We Get Here?) başarımını kazanmak için oyuncunun aynı anda ne yapması gerekir?",
    answers: ["3 boyutu da 1 dakikada gezmek", "Oyundaki tüm iksir ve durum etkilerine aynı anda sahip olmak", "Y=-64'ten Y=320'ye Elytra ile çıkmak", "Warden ve Wither'ı aynı anda yenmek"],
    correctAnswer: 1,
    difficulty: "hard",
    category: "Minecraft mekanikleri",
    explanation: "'How Did We Get Here?' gizli başarımı, oyunda uygulanabilir tüm durum etkilerinin aynı anda oyuncuda aktif olmasını gerektirir."
  }
];
