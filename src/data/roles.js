export const ROLES = [
  {
    id: 'donor',
    label: 'Bağışçı',
    accent: 'from-cyan-500 to-blue-500',
  },
  {
    id: 'beneficiary',
    label: 'İhtiyaç Sahibi',
    accent: 'from-violet-500 to-fuchsia-500',
  },
  {
    id: 'merchant',
    label: 'Esnaf',
    accent: 'from-amber-500 to-orange-500',
  },
  {
    id: 'municipality',
    label: 'Belediye',
    accent: 'from-emerald-500 to-green-500',
  },
]

export const ROLE_FIELDS = {
  donor: [
    { name: 'name', label: 'Ad Soyad', type: 'text' },
    { name: 'email', label: 'E-posta', type: 'email' },
    { name: 'neighborhood', label: 'Mahalle', type: 'select' },
    { name: 'password', label: 'Parola', type: 'password' },
  ],
  beneficiary: [
    { name: 'name', label: 'Ad Soyad', type: 'text' },
    { name: 'neighborhood', label: 'Mahalle', type: 'select' },
    { name: 'password', label: 'Parola', type: 'password' },
  ],
  merchant: [
    { name: 'name', label: 'İşletme Adı', type: 'text' },
    { name: 'taxId', label: 'Vergi No', type: 'text' },
    { name: 'neighborhood', label: 'Mahalle', type: 'select' },
    { name: 'password', label: 'Parola', type: 'password' },
  ],
  municipality: [
    { name: 'name', label: 'Belediye Kullanıcısı', type: 'text' },
    { name: 'unit', label: 'Birim', type: 'text' },
    { name: 'neighborhood', label: 'Mahalle', type: 'select' },
    { name: 'password', label: 'Parola', type: 'password' },
  ],
}
