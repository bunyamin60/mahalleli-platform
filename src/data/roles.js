export const ROLES = [
  {
    id: 'donor',
    label: 'Bağışçı',
    accent: 'from-indigo-600 to-indigo-700',
  },
  {
    id: 'beneficiary',
    label: 'İhtiyaç Sahibi',
    accent: 'from-slate-800 to-slate-900',
  },
  {
    id: 'merchant',
    label: 'Esnaf',
    accent: 'from-emerald-600 to-emerald-700',
  },
  {
    id: 'municipality',
    label: 'Belediye',
    accent: 'from-indigo-600 to-emerald-600',
  },
]

export const ROLE_FIELDS = {
  donor: [
    { name: 'name', label: 'Ad Soyad', type: 'text' },
    { name: 'email', label: 'E-posta', type: 'email' },
    { name: 'tcKimlik', label: 'T.C. Kimlik No', type: 'text' },
    { name: 'phone', label: 'Telefon', type: 'tel' },
    { name: 'neighborhood', label: 'Mahalle', type: 'neighborhood' },
    { name: 'password', label: 'Parola', type: 'password' },
  ],
  beneficiary: [
    { name: 'name', label: 'Ad Soyad', type: 'text' },
    { name: 'email', label: 'E-posta', type: 'email' },
    { name: 'tcKimlik', label: 'T.C. Kimlik No', type: 'text' },
    { name: 'phone', label: 'Telefon', type: 'tel' },
    { name: 'address', label: 'Adres', type: 'text' },
    { name: 'neighborhood', label: 'Mahalle', type: 'neighborhood' },
    { name: 'password', label: 'Parola', type: 'password' },
  ],
  merchant: [
    { name: 'name', label: 'İşletme Adı', type: 'text' },
    { name: 'email', label: 'E-posta', type: 'email' },
    { name: 'tcKimlik', label: 'T.C. Kimlik No', type: 'text' },
    { name: 'merchantType', label: 'İşletme Tipi', type: 'merchantType' },
    { name: 'taxId', label: 'Vergi No', type: 'text' },
    { name: 'phone', label: 'Telefon', type: 'tel' },
    { name: 'neighborhood', label: 'Mahalle', type: 'neighborhood' },
    { name: 'password', label: 'Parola', type: 'password' },
  ],
  municipality: [
    { name: 'name', label: 'Belediye Kullanıcısı', type: 'text' },
    { name: 'email', label: 'E-posta', type: 'email' },
    { name: 'tcKimlik', label: 'T.C. Kimlik No', type: 'text' },
    { name: 'city', label: 'İl', type: 'city' },
    { name: 'district', label: 'İlçe', type: 'district' },
    { name: 'unit', label: 'Birim Seçiniz', type: 'municipalityUnit' },
    { name: 'password', label: 'Parola', type: 'password' },
  ],
}
