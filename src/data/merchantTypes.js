export const MERCHANT_TYPES = [
  { id: 'market', label: 'Market' },
  { id: 'manav', label: 'Manav' },
  { id: 'kasap', label: 'Kasap' },
]

export const PRODUCT_CATEGORIES = {
  TEMEL_GIDA: 'temel-gida',
  MEYVE_SEBZE: 'meyve-sebze',
  KASAP: 'kasap',
}

const MERCHANT_ALLOWED_CATEGORIES = {
  market: [PRODUCT_CATEGORIES.TEMEL_GIDA, PRODUCT_CATEGORIES.MEYVE_SEBZE],
  manav: [PRODUCT_CATEGORIES.MEYVE_SEBZE],
  kasap: [PRODUCT_CATEGORIES.KASAP],
}

export function getAllowedCategories(merchantType) {
  return MERCHANT_ALLOWED_CATEGORIES[merchantType] || []
}

export function canMerchantSellProduct(merchantType, productCategory) {
  return getAllowedCategories(merchantType).includes(productCategory)
}

export function getMerchantTypeLabel(merchantType) {
  return MERCHANT_TYPES.find((item) => item.id === merchantType)?.label || merchantType
}
