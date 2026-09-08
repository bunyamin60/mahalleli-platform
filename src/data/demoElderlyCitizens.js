import { getProductById } from './products'
import { DEFAULT_NEIGHBORHOOD } from './locations'

/** Belediye onaylı demo yaşlı vatandaşlar — esnaf T.C. sorgulama modülü test verisi */
export const DEMO_ELDERLY_BENEFICIARIES = [
  {
    tcKimlik: '11111111111',
    name: 'Ayşe Yılmaz',
    email: 'ayse.yilmaz@demo.mahalleli.local',
    phone: '05321112233',
    address: 'Doğu Mah. Örnek Sok. No:12 Pendik/İstanbul',
    neighborhood: 'Doğu',
    password: 'demo123',
    municipalityApproved: true,
    isApproved: true,
    role: 'beneficiary',
  },
  {
    tcKimlik: '22222222222',
    name: 'Fatma Demir',
    email: 'fatma.demir@demo.mahalleli.local',
    phone: '05324445566',
    address: 'Kaynarca Mah. Sahil Cad. No:5 Pendik/İstanbul',
    neighborhood: 'Kaynarca',
    password: 'demo123',
    municipalityApproved: true,
    isApproved: true,
    role: 'beneficiary',
  },
]

export function createAyseFundedRequest() {
  const product = getProductById('tg-un')
  return {
    id: 'demo-seed-ayse-funded',
    beneficiaryName: 'Ayşe Yılmaz',
    beneficiaryTc: '11111111111',
    productIds: ['tg-un'],
    productTotal: product?.price || 45,
    courierFee: 0,
    deliveryMethod: 'pickup',
    totalAmount: product?.price || 45,
    status: 'funded',
    donorName: 'Demo Bağışçı',
    merchantName: null,
    qrCode: 'MHL-DEMO-AYSE-FOOD-001',
    fundedAt: new Date().toISOString(),
    demoSeed: 'ayse-funded',
    municipalityApproved: true,
  }
}

export function mergeDemoElderlySeed(state) {
  let users = [...state.users]
  let requests = [...state.requests]

  for (const citizen of DEMO_ELDERLY_BENEFICIARIES) {
    const exists = users.some(
      (user) => user.role === 'beneficiary' && user.tcKimlik === citizen.tcKimlik,
    )
    if (!exists) {
      users.push({ ...citizen, neighborhood: citizen.neighborhood || DEFAULT_NEIGHBORHOOD })
    } else {
      users = users.map((user) =>
        user.role === 'beneficiary' && user.tcKimlik === citizen.tcKimlik
          ? {
              ...user,
              municipalityApproved: true,
              isApproved: true,
              name: citizen.name,
              email: user.email || citizen.email,
              phone: user.phone || citizen.phone,
              address: user.address || citizen.address,
              neighborhood: citizen.neighborhood,
            }
          : user,
      )
    }
  }

  const ayseFundedActive = requests.some(
    (item) => item.demoSeed === 'ayse-funded' && item.status === 'funded',
  )
  if (!ayseFundedActive) {
    requests = requests.filter((item) => item.demoSeed !== 'ayse-funded')
    requests.unshift(createAyseFundedRequest())
  }

  return { ...state, users, requests }
}
