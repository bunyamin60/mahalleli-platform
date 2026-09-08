import { PRODUCT_CATEGORIES, canMerchantSellProduct } from './merchantTypes'

const temelGida = [
  {
    id: 'tg-un',
    name: 'Un (1 kg)',
    price: 45,
    category: PRODUCT_CATEGORIES.TEMEL_GIDA,
    unit: 'kg',
    imageUrl: '/images/un.jpg',
  },
  {
    id: 'tg-pirinc',
    name: 'Pirinç (1 kg)',
    price: 55,
    category: PRODUCT_CATEGORIES.TEMEL_GIDA,
    unit: 'kg',
    imageUrl: '/images/princ.jpg',
  },
  {
    id: 'tg-makarna',
    name: 'Makarna (500 g)',
    price: 22,
    category: PRODUCT_CATEGORIES.TEMEL_GIDA,
    unit: 'adet',
    imageUrl: '/images/makarna.jpg',
  },
  {
    id: 'tg-yag',
    name: 'Ayçiçek Yağı (1 L)',
    price: 85,
    category: PRODUCT_CATEGORIES.TEMEL_GIDA,
    unit: 'L',
    imageUrl: '/images/aycicekyagi.jpg',
  },
  {
    id: 'tg-seker',
    name: 'Toz Şeker (1 kg)',
    price: 38,
    category: PRODUCT_CATEGORIES.TEMEL_GIDA,
    unit: 'kg',
    imageUrl: '/images/tozseker.jpg',
  },
  {
    id: 'tg-tuz',
    name: 'Tuz (750 g)',
    price: 12,
    category: PRODUCT_CATEGORIES.TEMEL_GIDA,
    unit: 'adet',
    imageUrl: '/images/tuz.jpg',
  },
  {
    id: 'tg-cay',
    name: 'Çay (1 kg)',
    price: 65,
    category: PRODUCT_CATEGORIES.TEMEL_GIDA,
    unit: 'kg',
    imageUrl: '/images/cay.jpg',
  },
  {
    id: 'tg-sut',
    name: 'Süt (1 L)',
    price: 28,
    category: PRODUCT_CATEGORIES.TEMEL_GIDA,
    unit: 'L',
    imageUrl: '/images/sut.jpg',
  },
  {
    id: 'tg-yumurta',
    name: 'Yumurta (10 adet)',
    price: 48,
    category: PRODUCT_CATEGORIES.TEMEL_GIDA,
    unit: 'koli',
    imageUrl: '/images/yumurta.jpg',
  },
  {
    id: 'tg-ekmek',
    name: 'Ekmek',
    price: 15,
    category: PRODUCT_CATEGORIES.TEMEL_GIDA,
    unit: 'adet',
    imageUrl: '/images/ekmek.jpg',
  },
  {
    id: 'tg-mercimek',
    name: 'Mercimek (1 kg)',
    price: 42,
    category: PRODUCT_CATEGORIES.TEMEL_GIDA,
    unit: 'kg',
    imageUrl: '/images/mercimek.jpg',
  },
  {
    id: 'tg-bulgur',
    name: 'Bulgur (1 kg)',
    price: 40,
    category: PRODUCT_CATEGORIES.TEMEL_GIDA,
    unit: 'kg',
    imageUrl: '/images/bulgur.jpg',
  },
  {
    id: 'tg-salca',
    name: 'Domates Salçası (830 g)',
    price: 35,
    category: PRODUCT_CATEGORIES.TEMEL_GIDA,
    unit: 'adet',
    imageUrl: '/images/domatessalcasi.jpg',
  },
  {
    id: 'tg-sabun',
    name: 'Banyo Sabunu (4 adet)',
    price: 25,
    category: PRODUCT_CATEGORIES.TEMEL_GIDA,
    unit: 'paket',
    imageUrl: '/images/banyosabunu.jpg',
  },
  {
    id: 'tg-deterjan',
    name: 'Çamaşır Deterjanı (3 kg)',
    price: 95,
    category: PRODUCT_CATEGORIES.TEMEL_GIDA,
    unit: 'adet',
    imageUrl: '/images/camasirdeterjani.jpg',
  },
]

const meyveSebze = [
  {
    id: 'ms-domates',
    name: 'Domates (1 kg)',
    price: 35,
    category: PRODUCT_CATEGORIES.MEYVE_SEBZE,
    unit: 'kg',
    imageUrl: '/images/domates.jpg',
  },
  {
    id: 'ms-elma',
    name: 'Elma (1 kg)',
    price: 30,
    category: PRODUCT_CATEGORIES.MEYVE_SEBZE,
    unit: 'kg',
    imageUrl: '/images/elma.jpg',
  },
  {
    id: 'ms-muz',
    name: 'Muz (1 kg)',
    price: 45,
    category: PRODUCT_CATEGORIES.MEYVE_SEBZE,
    unit: 'kg',
    imageUrl: '/images/muz.jpg',
  },
  {
    id: 'ms-patates',
    name: 'Patates (1 kg)',
    price: 28,
    category: PRODUCT_CATEGORIES.MEYVE_SEBZE,
    unit: 'kg',
    imageUrl: '/images/patataes.jpg',
  },
  {
    id: 'ms-sogan',
    name: 'Soğan (1 kg)',
    price: 22,
    category: PRODUCT_CATEGORIES.MEYVE_SEBZE,
    unit: 'kg',
    imageUrl: '/images/sogan.jpg',
  },
]

const kasap = [
  {
    id: 'ks-kiyma',
    name: 'Kıyma (1 kg)',
    price: 280,
    category: PRODUCT_CATEGORIES.KASAP,
    unit: 'kg',
    imageUrl: '/images/kiyma.jpg',
  },
  {
    id: 'ks-tavuk',
    name: 'Tavuk Göğsü (1 kg)',
    price: 180,
    category: PRODUCT_CATEGORIES.KASAP,
    unit: 'kg',
    imageUrl: '/images/tavuk.jpg',
  },
  {
    id: 'ks-kofte',
    name: 'Köfte (1 kg)',
    price: 220,
    category: PRODUCT_CATEGORIES.KASAP,
    unit: 'kg',
    imageUrl: '/images/kofte.jpg',
  },
  {
    id: 'ks-sucuk',
    name: 'Sucuk (500 g)',
    price: 150,
    category: PRODUCT_CATEGORIES.KASAP,
    unit: 'adet',
    imageUrl: '/images/sucuk.jpg',
  },
  {
    id: 'ks-salam',
    name: 'Salam (500 g)',
    price: 120,
    category: PRODUCT_CATEGORIES.KASAP,
    unit: 'adet',
    imageUrl: '/images/salam.jpg',
  },
]

export const PRODUCTS = [...temelGida, ...meyveSebze, ...kasap]

export const COURIER_FEE = 50
export const POOL_WAIT_DAYS = 3

export function getProductById(id) {
  return PRODUCTS.find((item) => item.id === id)
}

export function getProductsForMerchantType(merchantType) {
  return PRODUCTS.filter((product) => canMerchantSellProduct(merchantType, product.category))
}
