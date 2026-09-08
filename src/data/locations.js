export const CITIES = ['İstanbul']

export const DISTRICTS_BY_CITY = {
  İstanbul: ['Pendik'],
}

/** İstanbul / Pendik mahalleleri */
export const NEIGHBORHOODS = [
  'Doğu',
  'Batı',
  'Yenişehir',
  'Kaynarca',
  'Çamçeşme',
  'Güzelyalı',
  'Kurtköy',
  'Sapanbağları',
  'Fevzi Çakmak',
  'Esenyalı',
  'Bahçelievler',
  'Çınardere',
  'Orhangazi',
  'Şeyhli',
  'Velibaba',
]

export const DEFAULT_CITY = 'İstanbul'
export const DEFAULT_DISTRICT = 'Pendik'
export const DEFAULT_NEIGHBORHOOD = NEIGHBORHOODS[0]

export function getDistrictsForCity(city) {
  return DISTRICTS_BY_CITY[city] || []
}
