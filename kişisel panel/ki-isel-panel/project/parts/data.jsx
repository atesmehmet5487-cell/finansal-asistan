// Seed data for the panel — all Turkish, finance-flavored

const KPIS = [
  { id: 'signals',      eyebrow: 'Bugünkü Sinyaller', value: 47,    unit: 'adet', delta: '+12',  trend: 'up',   tone: 'warm',  icon: '🎯', spark: [3,5,4,7,6,9,8,11] },
  { id: 'opps',         eyebrow: 'Fırsat Uyarısı',     value: 8,     unit: 'aktif', delta: '+2',   trend: 'up',   tone: 'green', icon: '📈', spark: [1,2,2,4,3,5,6,8] },
  { id: 'risks',        eyebrow: 'Risk Uyarısı',       value: 3,     unit: 'aktif', delta: '−1',   trend: 'down', tone: 'red',   icon: '⚠️', spark: [6,5,4,4,3,3,4,3] },
  { id: 'sentiment',    eyebrow: 'Piyasa Duyarlılığı', value: 62,    unit: '%',    delta: '+4 pt', trend: 'up',   tone: 'amber', icon: '🌡️', spark: [40,45,50,48,55,58,60,62] },
];

const PIPELINE = [
  {
    num: '01', title: 'Veri Toplama', active: true,
    items: ['RSS Feed\'ler', 'Web Scraping', 'Finansal API\'ler', 'Sosyal Medya'],
    foot: '124 kaynak aktif',
  },
  {
    num: '02', title: 'İşleme & Analiz', active: true,
    items: ['Gürültü Filtreleme', 'Duyarlılık (Sentiment)', 'Önem Skorlaması', 'N8N Orkestrasyonu'],
    foot: 'Son 1dk: 312 mesaj',
  },
  {
    num: '03', title: 'İçgörü Üretimi', active: true,
    items: ['Claude 3.5 Sonnet', 'Fırsat Sinyalleri', 'Risk Uyarıları', 'Korelasyon Tespiti'],
    foot: 'Bugün 47 içgörü',
  },
  {
    num: '04', title: 'Bildirim & Rapor', active: true,
    items: ['Telegram Anlık Uyarı', 'Sabah Brifingi', 'Notion Arşivi', 'Haftalık Özet'],
    foot: '14 bildirim gönderildi',
  },
];

const SOURCES = [
  { no: '01', name: 'Finansal Haberler', sub: 'Reuters, Bloomberg, CNBC, WSJ',          status: 'live',  rate: 248, emoji: '📰' },
  { no: '02', name: 'SEC Dosyaları',     sub: 'EDGAR veritabanı, 10-K, 10-Q, 8-K',      status: 'live',  rate: 14,  emoji: '📄' },
  { no: '03', name: 'Twitter / X',       sub: 'FinTwit duyarlılığı, CEO tweetleri',    status: 'live',  rate: 1320,emoji: '🐦' },
  { no: '04', name: 'Reddit',            sub: 'WallStreetBets, r/investing',            status: 'live',  rate: 412, emoji: '👥' },
  { no: '05', name: 'Kazanç Raporları',  sub: 'Earnings calls, sürpriz oranları',       status: 'idle',  rate: 6,   emoji: '💰' },
  { no: '06', name: 'Fed Açıklamaları',  sub: 'FOMC tutanakları, faiz kararları',       status: 'live',  rate: 2,   emoji: '🏛️' },
  { no: '07', name: 'Google Trends',     sub: 'Arama hacmi değişimleri',                status: 'live',  rate: 84,  emoji: '📊' },
  { no: '08', name: 'Insider İşlemleri', sub: 'Form 4 bildirimleri, yönetici alım/satım', status: 'live', rate: 28, emoji: '🔍' },
  { no: '09', name: 'Analist Raporları', sub: 'Derecelendirme, fiyat hedefleri',        status: 'warn',  rate: 11,  emoji: '📑' },
  { no: '10', name: 'Makroekonomik',     sub: 'CPI, NFP, işsizlik, PMI verileri',       status: 'live',  rate: 4,   emoji: '🌍' },
];

const SIGNALS = [
  {
    id: 's1', kind: 'opp', emoji: '📈', title: 'NVDA — Önemli call opsiyon akışı',
    body: 'Son 30dk içinde olağandışı seviyede call opsiyon hacmi tespit edildi. Implied volatility %18 arttı.',
    tickers: ['NVDA'], score: 92, time: '3dk önce', source: 'Twitter / X + Opsiyon Akışı',
    read: false,
  },
  {
    id: 's2', kind: 'risk', emoji: '⚠️', title: 'META insider satış zirvesi',
    body: '3 üst düzey yönetici son 5 gün içinde toplam $24M satış yaptı. Tarihsel pattern bearish.',
    tickers: ['META'], score: 78, time: '12dk önce', source: 'SEC Form 4',
    read: false,
  },
  {
    id: 's3', kind: 'corr', emoji: '🔗', title: 'TLT ↔ XLF korelasyonu kırıldı',
    body: '20 günlük rolling korelasyon −0.74\'ten +0.12\'ye sıçradı. Faiz pozisyonlamasında dönüş sinyali.',
    tickers: ['TLT','XLF'], score: 71, time: '28dk önce', source: 'Makro + Korelasyon Motoru',
    read: false,
  },
  {
    id: 's4', kind: 'news', emoji: '📰', title: 'Fed başkanı Powell — gevşeme sinyali',
    body: 'Jackson Hole konuşmasında "düşen enflasyon" ve "veri-bağımlı yaklaşım" vurgusu. Sentiment +0.62.',
    tickers: ['SPY','QQQ'], score: 88, time: '1sa önce', source: 'Reuters + Fed Açıklamaları',
    read: true,
  },
  {
    id: 's5', kind: 'opp', emoji: '🎯', title: 'TSLA — Reddit duyarlılığı yükseliyor',
    body: 'WallStreetBets son 6 saat içinde 1.2K mention, sentiment +0.41. Geçmiş pattern: 2 gün +%3.8 ort.',
    tickers: ['TSLA'], score: 64, time: '1sa önce', source: 'Reddit + Sentiment',
    read: true,
  },
  {
    id: 's6', kind: 'risk', emoji: '🚨', title: 'VIX 18 üstü — koruma maliyetinde artış',
    body: 'VIX son 3 gün +%22. Hedge maliyetleri arttı. Aktif risk pozisyonlarınızı gözden geçirin.',
    tickers: ['VIX','SPX'], score: 69, time: '2sa önce', source: 'Piyasa Verisi',
    read: true,
  },
];

const BRIEFINGS = [
  { id: 'b1', title: 'Sabah Brifingi — 16 Mayıs Cuma', time: 'Bugün 08:00', items: 14, kind: 'morning' },
  { id: 'b2', title: 'Haftalık Özet — 19. Hafta',     time: '13 May 18:00', items: 47, kind: 'weekly'  },
  { id: 'b3', title: 'Sabah Brifingi — 15 Mayıs',     time: '15 May 08:00', items: 11, kind: 'morning' },
  { id: 'b4', title: 'Sabah Brifingi — 14 Mayıs',     time: '14 May 08:00', items: 9,  kind: 'morning' },
];

const ACTIVITY = [
  { time: '14:31', emoji: '🔔', text: 'NVDA fırsat sinyali Telegram\'a gönderildi' },
  { time: '14:18', emoji: '📰', text: 'Bloomberg makalesi içgörüye dönüştürüldü' },
  { time: '14:02', emoji: '⚠️',  text: 'META insider satış uyarısı oluşturuldu' },
  { time: '13:47', emoji: '📑', text: '8 yeni SEC dosyası tarandı' },
  { time: '13:30', emoji: '✅', text: 'N8N orkestrasyonu sağlık kontrolü geçti' },
  { time: '13:12', emoji: '🔍', text: '12 insider transaction filtrelendi' },
];
