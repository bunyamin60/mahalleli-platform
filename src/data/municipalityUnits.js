export const MUNICIPALITY_UNITS = [
  {
    id: 'baskan-yardimciligi',
    label: 'Başkan Yardımcılığı',
    canApproveBeneficiaries: true,
  },
  {
    id: 'bilisim',
    label: 'Bilişim Teknolojileri Müdürlüğü',
    canApproveBeneficiaries: false,
  },
  {
    id: 'sosyal-destek',
    label: 'Sosyal Destek Hizmetleri Müdürlüğü',
    canApproveBeneficiaries: true,
  },
]

export function getMunicipalityUnit(unitId) {
  return MUNICIPALITY_UNITS.find((item) => item.id === unitId)
}

export function canApproveBeneficiaries(unitId) {
  return Boolean(getMunicipalityUnit(unitId)?.canApproveBeneficiaries)
}

export function getMunicipalityUnitLabel(unitId) {
  return getMunicipalityUnit(unitId)?.label || unitId || '—'
}
