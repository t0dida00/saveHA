export type Trade = 'TP' | 'EU' | 'Asia' | 'Other'

export const TRADES: Trade[] = ['TP', 'EU', 'Asia', 'Other']

// The default lists Report settings starts from. Port names as the MBL lists write them, plus airports as the MAWB
// lists do (cities or airport names). TP is the trans-Pacific lane: US and Canada, inland points included.
// Unlisted ports count as Other; the Other list is for names that should be Other even though they contain a listed one
const PORTS: Record<Exclude<Trade, 'Other'>, string[]> = {
  TP: [
    'ANCHORAGE',
    'ATLANTA',
    'BALTIMORE',
    'BOSTON',
    'BUFFALO',
    'CALGARY',
    'CHARLESTON',
    'CHARLOTTE',
    'CHICAGO',
    'CINCINNATI',
    'CLEVELAND',
    'COLUMBUS',
    'DALLAS',
    'DENVER',
    'DETROIT',
    'EDMONTON',
    'EL PASO',
    'GALVESTON',
    'HALIFAX',
    'HONOLULU',
    'HOUSTON',
    'INDIANAPOLIS',
    'JACKSONVILLE',
    'KANSAS CITY',
    'LAREDO',
    'LONG BEACH',
    'LOS ANGELES',
    'LOUISVILLE',
    'MEMPHIS',
    'MIAMI',
    'MINNEAPOLIS',
    'MOBILE',
    'MONTREAL',
    'NASHVILLE',
    'NEW ORLEANS',
    'NEW YORK',
    'NEWARK',
    'NORFOLK',
    'OAKLAND',
    'OMAHA',
    'PHILADELPHIA',
    'PHOENIX',
    'PITTSBURGH',
    'PORT EVERGLADES',
    'PORTLAND',
    'PRINCE RUPERT',
    'SAINT JOHN',
    'SALT LAKE CITY',
    'SAN DIEGO',
    'SAN FRANCISCO',
    'SAVANNAH',
    'SEATTLE',
    'ST LOUIS',
    'TACOMA',
    'TAMPA',
    'TORONTO',
    'VANCOUVER',
    'WILMINGTON',
    'WINNIPEG',
    // Airports
    'DALLAS FORT WORTH',
    'GERALD R. FORD',
    'GRAND RAPIDS',
    'HARTSFIELD JACKSON',
    'JFK',
    'JOHN F. KENNEDY',
    "O'HARE",
  ],
  EU: [
    'AARHUS',
    'ALGECIRAS',
    'AMBARLI',
    'ANTWERP',
    'ANTWERPEN',
    'BAR',
    'BARCELONA',
    'BILBAO',
    'BREMEN',
    'BREMERHAVEN',
    'CONSTANTA',
    'COPENHAGEN',
    'CORK',
    'DUBLIN',
    'DUNKIRK',
    'DURRES',
    'FELIXSTOWE',
    'FOS-SUR-MER',
    'GDANSK',
    'GDYNIA',
    'GEMLIK',
    'GENOA',
    'GENOVA',
    'GIOIA TAURO',
    'GOTEBORG',
    'GOTHENBURG',
    'GRANGEMOUTH',
    'HAMBURG',
    'HELSINGBORG',
    'HELSINKI',
    'IMMINGHAM',
    'ISTANBUL',
    'IZMIR',
    'IZMIT',
    'KLAIPEDA',
    'KOPER',
    'LA SPEZIA',
    'LE HAVRE',
    'LEIXOES',
    'LISBON',
    'LIVERPOOL',
    'LIVORNO',
    'LONDON GATEWAY',
    'MALTA',
    'MARSAXLOKK',
    'MARSEILLE',
    'MERSIN',
    'NAPLES',
    'NOVOROSSIYSK',
    'ODESSA',
    'OSLO',
    'PIRAEUS',
    'POTI',
    'REYKJAVIK',
    'RIGA',
    'RIJEKA',
    'ROSTOCK',
    'ROTTERDAM',
    'SAINT PETERSBURG',
    'SALERNO',
    'SINES',
    'SOUTHAMPTON',
    'ST PETERSBURG',
    'TALLINN',
    'THESSALONIKI',
    'TILBURY',
    'TRIESTE',
    'VALENCIA',
    'VARNA',
    'VENICE',
    'VIGO',
    'ZEEBRUGGE',
    // Airports
    'AMSTERDAM',
    'BRUSSELS',
    'BUDAPEST',
    'CHARLES DE GAULLE',
    'FRANKFURT',
    'HEATHROW',
    'LEIPZIG',
    'LIEGE',
    'LONDON',
    'LUXEMBOURG',
    'LYON',
    'MADRID',
    'MALPENSA',
    'MILAN',
    'MUNICH',
    'PARIS',
    'PRAGUE',
    'SCHIPHOL',
    'VIENNA',
    'WARSAW',
    'ZURICH',
  ],
  Asia: [
    "AL 'AQABAH",
    'ABU DHABI',
    'ASHDOD',
    'BAHRAIN',
    'BANDAR ABBAS',
    'BANGKOK',
    'BUSAN',
    'CAI MEP',
    'CAT LAI',
    'CEBU',
    'CHATTOGRAM',
    'CHENNAI',
    'CHIBA',
    'CHITTAGONG',
    'CHONGQING',
    'COLOMBO',
    'DA NANG',
    'DALIAN',
    'DAMMAM',
    'DOHA',
    'FUZHOU',
    'GUANGZHOU',
    'HAIFA',
    'HAIPHONG',
    'HAKATA',
    'HAMAD',
    'HO CHI MINH',
    'HO CHI MINH CITY',
    'HONG KONG',
    'HUANGPU',
    'HUMEN',
    'INCHEON',
    'JAKARTA',
    'JEBEL ALI',
    'JEDDAH',
    'JIUJIANG',
    'KAOHSIUNG',
    'KARACHI',
    'KEELUNG',
    'KITAKYUSHU',
    'KOBE',
    'KOLKATA',
    'KUWAIT',
    'LAEM CHABANG',
    'LAT KRABANG',
    'LIANYUNGANG',
    'MANILA',
    'MOJI',
    'MUNDRA',
    'NAGOYA',
    'NANJING',
    'NANSHA',
    'NANSHAN',
    'NHAVA SHEVA',
    'NINGBO',
    'OSAKA',
    'PASIR GUDANG',
    'PENANG',
    'PHNOM PENH',
    'PORT KLANG',
    'QINGDAO',
    'QINZHOU',
    'SALALAH',
    'SHANGHAI',
    'SHANTOU',
    'SHEKOU',
    'SHENZHEN',
    'SHIBUSHI',
    'SIHANOUKVILLE',
    'SINGAPORE',
    'SOHAR',
    'SURABAYA',
    'TAICANG',
    'TAICHUNG',
    'TANJUNG PELEPAS',
    'TIANJIN',
    'TOKYO',
    'TOYOHASHI',
    'VLADIVOSTOK',
    'WUHAN',
    'XIAMEN',
    'XINGANG',
    'YANGON',
    'YANTIAN',
    'YOKOHAMA',
    'ZHANGJIAGANG',
    'ZHANJIANG',
    'ZHUHAI',
    // Airports
    'BAIYUN',
    'BEIJING',
    'CHANGI',
    'CHENGDU',
    'DUBAI',
    'HANEDA',
    'HANOI',
    'KANSAI',
    'KUALA LUMPUR',
    'NARITA',
    'NOI BAI',
    'PUDONG',
    'SEOUL',
    'SOEKARNO-HATTA',
    'SUVARNABHUMI',
    'TAIPEI',
    'TAN SON NHAT',
    'TAOYUAN',
  ],
}

export const DEFAULT_TRADE_PORTS: Record<Trade, string[]> = { ...PORTS, Other: [] }

// "SHEKOU PT" → "SHEKOU", "MEMPHIS INT'L" → "MEMPHIS", "VÁCLAV HAVEL AIRPORT PRAGUE" → "VACLAV HAVEL PRAGUE"
export const cleanPort = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\b(INT'L|INTERNATIONAL|AIRPORT)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ (PT|PORT)$/, '')

// Hyphens count as spaces when looking inside a name, so FRANKFURT-HAHN contains FRANKFURT
const asWords = (name: string) => ` ${name.replace(/-/g, ' ')} `

/** A POD's lane and the listed name that matched it; `port` is null when no list has it, so it is Other */
export type TradeMatch = { trade: Trade; port: string | null }

/** Matches a POD against these lists; names like "TINCAN/LAGOS" match on any part */
export function createTradeMatcher(ports: Record<Trade, string[]>) {
  const tradeByPort = new Map<string, Trade>()
  for (const trade of TRADES) for (const port of ports[trade]) tradeByPort.set(cleanPort(port), trade)

  // For names that only contain a known one ("LOUISVILLE MUHAMMAD ALI" has LOUISVILLE), longest first.
  // Short names like BAR are left out so they cannot match inside unrelated names
  const contained = [...tradeByPort.keys()]
    .filter((port) => port.length >= 4)
    .sort((a, b) => b.length - a.length)
    .map((port) => ({ port, words: asWords(port) }))

  return (pod: unknown): TradeMatch | null => {
    if (typeof pod !== 'string' || pod.trim() === '') return null
    const parts = [pod, ...pod.split(/\/| - /)].map(cleanPort)
    for (const part of parts) {
      const trade = tradeByPort.get(part)
      if (trade) return { trade, port: part }
    }
    const name = asWords(parts[0])
    const match = contained.find(({ words }) => name.includes(words))
    return match ? { trade: tradeByPort.get(match.port)!, port: match.port } : { trade: 'Other', port: null }
  }
}

/** Looks up a POD's trade lane in these lists */
export function createTradeLookup(ports: Record<Trade, string[]>) {
  const match = createTradeMatcher(ports)
  return (pod: unknown): Trade | null => match(pod)?.trade ?? null
}

/** Trade lane for a POD with the default lists */
export const tradeFromPod = createTradeLookup(DEFAULT_TRADE_PORTS)

/** Saved lists checked for shape; a missing or malformed list falls back to its default */
export function normalizeTradePorts(stored: unknown): Record<Trade, string[]> {
  const lists = typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {}
  return Object.fromEntries(
    TRADES.map((trade) => {
      const list = lists[trade]
      const valid = Array.isArray(list) && list.every((port) => typeof port === 'string')
      return [trade, valid ? (list as string[]) : DEFAULT_TRADE_PORTS[trade]]
    }),
  ) as Record<Trade, string[]>
}
