from fastapi import APIRouter, HTTPException
from cache.redis_client import cache_get, cache_set, TTL

router = APIRouter()

KNOWN_SYMBOLS = {
    # BIST 30 — büyük cap
    "ASELS": "Aselsan Elektronik",
    "THYAO": "Türk Hava Yolları",
    "GARAN": "Garanti BBVA",
    "AKBNK": "Akbank",
    "ISCTR": "İş Bankası C",
    "EREGL": "Ereğli Demir Çelik",
    "KCHOL": "Koç Holding",
    "SAHOL": "Sabancı Holding",
    "SISE": "Şişecam",
    "TUPRS": "Tüpraş",
    "BIMAS": "BİM Mağazalar",
    "MGROS": "Migros",
    "TCELL": "Turkcell",
    "ARCLK": "Arçelik",
    "TOASO": "Tofaş Türk Otomobil",
    "FROTO": "Ford Otosan",
    "DOHOL": "Doğan Holding",
    "TTKOM": "Türk Telekom",
    "PGSUS": "Pegasus Hava Yolları",
    "VESTL": "Vestel Elektronik",
    # Bankacılık
    "YKBNK": "Yapı ve Kredi Bankası",
    "VAKBN": "Vakıfbank",
    "HALKB": "Halkbank",
    "QNBFB": "QNB Finansbank",
    "SKBNK": "Şekerbank",
    "ALBRK": "Albaraka Türk Katılım Bankası",
    "TSKB": "Türkiye Sınai Kalkınma Bankası",
    "FIBABANKA": "Fibabanka",
    # Sigorta & Emeklilik
    "TURSG": "Türkiye Sigorta",
    "ANHYT": "Anadolu Hayat Emeklilik",
    "ANSGR": "Anadolu Sigorta",
    "AKGRT": "Aksigorta",
    "RAYSG": "Ray Sigorta",
    "GUSGF": "Güneş Sigorta",
    # Holding
    "AGHOL": "Anadolu Grubu Holding",
    "GLYHO": "Global Yatırım Holding",
    "ALARK": "Alarko Holding",
    "BERA": "Bera Holding",
    "POLHO": "Polisan Holding",
    "IHAAS": "İhlas Holding A",
    "DENGE": "Denge Yatırım Holding",
    # Enerji & Elektrik
    "AKSEN": "Akenerji Elektrik",
    "ODAS": "Odaş Elektrik",
    "ZOREN": "Zorlu Enerji",
    "AYDEM": "Aydem Enerji",
    "AYEN": "Ayen Enerji",
    "GWIND": "Galata Wind Enerji",
    "EUPWR": "Europower Enerji",
    "SMART": "Smart Güneş Enerjisi",
    "AKFYE": "Akfen Yenilenebilir Enerji",
    "ORGE": "Orge Enerji Elektrik",
    "KONTR": "Kontrolmatik Teknoloji",
    "MAGEN": "Magen Enerji",
    "IPEKE": "İpekyolu Holding",
    "ENKAI": "Enka İnşaat",
    "TKFEN": "Tekfen Holding",
    "ULUSE": "Ulusoy Elektrik",
    # Petrokimya & Kimya
    "PETKM": "Petkim Petrokimya",
    "SASA": "Sasa Polyester",
    "AKSA": "Aksa Akrilik Kimya",
    "ALKIM": "Alkim Kimya Sanayi",
    "BAGFS": "Bagfaş Bandırma Gübre",
    "GUBRF": "Gübre Fabrikaları",
    "EPLAS": "Ege Plastik Ambalaj",
    # Demir Çelik & Metal
    "ISDMR": "İskenderun Demir Çelik",
    "BRSAN": "Borusan Mannesmann",
    "KRDMA": "Kardemir A",
    "KRDMB": "Kardemir B",
    "KRDMD": "Kardemir D",
    "CELHA": "Celha Çelik Hasır",
    "CEMAS": "Çemaş Döküm",
    "CEMTS": "Çemtaş Çelik",
    "PRKME": "Park Elektrik Madencilik",
    # Çimento & İnşaat Malzemeleri
    "CIMSA": "Çimsa Çimento",
    "NUHCM": "Nuh Çimento",
    "KCAER": "Kayseri Çimento",
    "AKCNS": "Akçansa Çimento",
    "BOLUC": "Bolu Çimento",
    "GOLTS": "Göltaş Çimento",
    "UNYEC": "Ünye Çimento",
    "ADANA": "Adana Çimento A",
    "BUCIM": "Bursa Çimento",
    "MRDIN": "Mardin Çimento",
    "KONYA": "Konya Çimento",
    # Cam & Seramik
    "TRKCM": "Trakya Cam Sanayii",
    "ANACM": "Anadolu Cam Sanayii",
    "USAK": "Uşak Seramik",
    # GYO
    "EKGYO": "Emlak Konut GYO",
    "TRGYO": "Torunlar GYO",
    "ZRGYO": "Ziraat GYO",
    "HLGYO": "Halk GYO",
    "ISGYO": "İş GYO",
    "SNGYO": "Sinpaş GYO",
    "ALGYO": "Alarko GYO",
    "OZGYO": "Özak GYO",
    "KLGYO": "Kiler GYO",
    "VKGYO": "Vakıf GYO",
    "AGYO": "Atakule GYO",
    "MRGYO": "Martı GYO",
    "RYGYO": "Reysaş GYO",
    "DZGYO": "Deniz GYO",
    # Otomotiv & Yan Sanayi
    "OTKAR": "Otokar",
    "KARSN": "Karsan Otomotiv",
    "TTRAK": "Türk Traktör",
    "ASUZU": "Anadolu Isuzu",
    "DOAS": "Doğuş Otomotiv",
    "JANTS": "Jantsa Jant Sanayi",
    "PARSN": "Parsan Makina Parçaları",
    "DITAS": "Ditaş Doğan Yedek Parça",
    "BFREN": "Bosch Fren Sistemleri",
    "GOODY": "Goodyear Lastikleri",
    "BRISA": "Brisa Bridgestone Sabancı",
    # Havacılık & Ulaştırma & Lojistik
    "TAVHL": "TAV Havalimanları",
    "CLEBI": "Çelebi Hava Servisi",
    "RYSAS": "Reysaş Taşımacılık",
    # Teknoloji & Bilişim
    "LOGO": "Logo Yazılım",
    "NETAS": "Netaş Telekomunikasyon",
    "INDES": "İndeks Bilgisayar",
    "TKNSA": "Teknosa İç ve Dış Ticaret",
    "KAREL": "Karel Elektronik",
    "ARDYZ": "Ardyz Bilişim",
    "PKART": "Plastikkart Akıllı Kart",
    "LINK": "Link Bilgisayar",
    "ARENA": "Arena Bilgisayar",
    "ESCOM": "Escom Elektronik",
    # Sağlık & İlaç
    "MPARK": "MLP Sağlık Hizmetleri",
    "DEVA": "Deva Holding",
    "SELEC": "Selçuk Ecza Deposu",
    "ECILC": "Eczacıbaşı İlaç",
    "LKMNH": "Lokman Hekim",
    "MEDTR": "Meditera Tıbbi Malzeme",
    "ECZYT": "Eczacıbaşı Yatırım",
    # Gıda & İçecek
    "AEFES": "Anadolu Efes Biracılık",
    "CCOLA": "Coca-Cola İçecek",
    "ULKER": "Ülker Bisküvi",
    "SOKM": "Şok Marketler",
    "ADESE": "Adese AVM",
    "AVOD": "Avod Kurutulmuş Gıda",
    "PNSUT": "Pınar Süt Mamülleri",
    "TATGD": "Tat Gıda",
    "PENGD": "Penguen Gıda",
    "KENT": "Kent Gıda",
    "TUKAS": "Tukaş Gıda",
    "BANVT": "Banvit Bandırma Vitaminli",
    "KNFRT": "Konfrut Gıda",
    # Perakende & Tekstil
    "MAVI": "Mavi Giyim",
    "LCWAL": "LC Waikiki Mağazacılık",
    "KORDS": "Kordsa Teknik Tekstil",
    "ARSAN": "Arsan Tekstil",
    "DESA": "Desa Deri Sanayi",
    "YATAS": "Yataş Yatak ve Yorgan",
    # Madencilik & Değerli Maden
    "KOZAL": "Koza Altın",
    "KOZAA": "Koza Anadolu Maden",
    "GOLDAS": "Goldaş Kuyumculuk",
    # Spor Kulüpleri
    "FENER": "Fenerbahçe Sportif",
    "BJKAS": "Beşiktaş JK",
    "GSRAY": "Galatasaray SK",
    "TSPOR": "Trabzonspor SK",
    # Endeksler
    "BIST100": "BIST 100 Endeksi",
    "BIST50": "BIST 50 Endeksi",
    "BIST30": "BIST 30 Endeksi",
    # Emtia & Döviz
    "ALTIN": "Altın (XAU/USD)",
    "GUMUS": "Gümüş (XAG/USD)",
    "PETROL": "Ham Petrol (Brent)",
    "DOLAR": "ABD Doları (USD/TRY)",
    "EURO": "Euro (EUR/TRY)",
    "BTC": "Bitcoin",
    "ETH": "Ethereum",
}


@router.get("/search")
async def search(q: str):
    if not q or len(q) < 2:
        return {"results": []}

    cache_key = f"cache:search:{q.lower()}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    q_upper = q.upper()
    q_lower = q.lower()

    matches = []
    for symbol, name in KNOWN_SYMBOLS.items():
        if q_upper in symbol or q_lower in name.lower():
            price_data = await cache_get(f"cache:price:{symbol}")
            consolidated = await cache_get(f"cache:asset:{symbol}:consolidated")
            matches.append({
                "symbol": symbol,
                "name": name,
                "price": price_data.get("price") if price_data else None,
                "change_pct": price_data.get("change_pct") if price_data else None,
                "composite_score": consolidated.get("composite_score") if consolidated else None,
                "overall_sentiment": consolidated.get("overall_sentiment") if consolidated else None,
            })

    result = {"results": matches[:10], "query": q}
    await cache_set(cache_key, result, TTL["search"])
    return result
