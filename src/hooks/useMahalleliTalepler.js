import { useCallback, useEffect, useMemo, useState } from 'react'
import { setProfileApproved } from '../services/dataService'

export const MAHALLELI_TALEPLER_KEY = 'mahalleli_talepler'

export function readMahalleliTalepler() {
  try {
    const raw = localStorage.getItem(MAHALLELI_TALEPLER_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeTalep) : []
  } catch {
    return []
  }
}

export function writeMahalleliTalepler(talepler) {
  try {
    localStorage.setItem(MAHALLELI_TALEPLER_KEY, JSON.stringify(talepler))
    window.dispatchEvent(new CustomEvent('mahalleli-talepler-updated'))
  } catch (error) {
    console.warn('[Mahalleli] talep yedeği yazılamadı', error)
  }
}

function normalizeIsim(isim) {
  return String(isim || '').trim().toLocaleLowerCase('tr-TR')
}

export function findTalepByIsim(talepler, isim) {
  const key = normalizeIsim(isim)
  return talepler.find((item) => normalizeIsim(item.isim) === key)
}

export const SAHA_TESPITI_BASVURU_METNI = 'Yeni İhtiyaç Sahibi Başvurusu (Saha Tespiti Bekliyor)'

function normalizeTalep(item) {
  const next = { ...item }
  if (item.paketAdi === 'Temel Gıda Paketi' && item.paketSecildi !== true) {
    next.paketAdi = null
  }
  return {
    ...next,
    tcKimlik: next.tcKimlik || '',
    phone: next.phone || '',
    address: next.address || '',
    email: next.email || '',
    neighborhood: next.neighborhood || '',
  }
}

function talepFromBeneficiary(user) {
  const approved = Boolean(user.isApproved || user.municipalityApproved)
  return normalizeTalep({
    id: user.id || `profile-${user.tcKimlik}`,
    isim: user.name,
    paketAdi: null,
    durum: approved ? 'onaylandi' : 'bekliyor',
    tcKimlik: user.tcKimlik || '',
    phone: user.phone || '',
    address: user.address || '',
    email: user.email || '',
    neighborhood: user.neighborhood || '',
    createdAt: user.createdAt || new Date().toISOString(),
  })
}

export function formatTalepKuyrukMetni(talep) {
  if (talep.paketAdi) {
    return `${talep.isim} — ${talep.paketAdi} Talebi`
  }
  return `${talep.isim} — ${SAHA_TESPITI_BASVURU_METNI}`
}

export function formatTalepOnayMetni(talep) {
  if (talep.paketAdi) {
    return `✓ ${talep.isim} — ${talep.paketAdi} talebi doğrulandı ve havuza aktarıldı.`
  }
  return `✓ ${talep.isim} — Yeni ihtiyaç sahibi başvurusu doğrulandı ve havuza aktarıldı.`
}

function mergeTaleplerWithUsers(current, users = []) {
  const beneficiaries = users.filter((user) => user.role === 'beneficiary')
  if (!beneficiaries.length) {
    return current
  }
  const byName = new Map(current.map((item) => [normalizeIsim(item.isim), item]))
  const byTc = new Map(current.filter((item) => item.tcKimlik).map((item) => [item.tcKimlik, item]))

  for (const user of beneficiaries) {
    const fromProfile = talepFromBeneficiary(user)
    const existing = (user.tcKimlik && byTc.get(user.tcKimlik)) || byName.get(normalizeIsim(user.name))
    if (existing) {
      const merged = {
        ...existing,
        ...fromProfile,
        id: existing.id,
        durum:
          fromProfile.durum === 'onaylandi' || existing.durum === 'onaylandi' ? 'onaylandi' : 'bekliyor',
      }
      byName.set(normalizeIsim(merged.isim), merged)
      if (merged.tcKimlik) {
        byTc.set(merged.tcKimlik, merged)
      }
    } else {
      byName.set(normalizeIsim(fromProfile.isim), fromProfile)
      if (fromProfile.tcKimlik) {
        byTc.set(fromProfile.tcKimlik, fromProfile)
      }
    }
  }

  return [...byName.values()]
}

export function useMahalleliTalepler() {
  const [talepler, setTalepler] = useState(readMahalleliTalepler)

  const syncTalepler = useCallback(() => {
    setTalepler(readMahalleliTalepler())
  }, [])

  useEffect(() => {
    syncTalepler()

    const onStorage = (event) => {
      if (event.key === MAHALLELI_TALEPLER_KEY || event.key === null) {
        syncTalepler()
      }
    }

    const onCustom = () => syncTalepler()
    const onHydrated = (event) => {
      const users = event.detail?.users
      if (!Array.isArray(users)) {
        return
      }
      const merged = mergeTaleplerWithUsers(readMahalleliTalepler(), users)
      writeMahalleliTalepler(merged)
      setTalepler(merged)
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('mahalleli-talepler-updated', onCustom)
    window.addEventListener('mahalleli-users-hydrated', onHydrated)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('mahalleli-talepler-updated', onCustom)
      window.removeEventListener('mahalleli-users-hydrated', onHydrated)
    }
  }, [syncTalepler])

  const ensureBekleyenTalep = useCallback((isim, profile = {}) => {
    const current = readMahalleliTalepler()
    const existing = findTalepByIsim(current, isim)
    if (existing) {
      const approved = Boolean(profile.isApproved || profile.municipalityApproved)
      const enriched = {
        ...existing,
        tcKimlik: profile.tcKimlik || existing.tcKimlik || '',
        phone: profile.phone || existing.phone || '',
        address: profile.address || existing.address || '',
        email: profile.email || existing.email || '',
        neighborhood: profile.neighborhood || existing.neighborhood || '',
        durum: approved ? 'onaylandi' : existing.durum,
      }
      if (JSON.stringify(enriched) !== JSON.stringify(existing)) {
        const next = current.map((item) => (item.id === existing.id ? enriched : item))
        writeMahalleliTalepler(next)
        setTalepler(next)
        return enriched
      }
      setTalepler(current)
      return existing
    }

    const newTalep = {
      id: crypto.randomUUID(),
      isim: String(isim).trim(),
      paketAdi: profile.paketAdi ?? null,
      durum: profile.isApproved || profile.municipalityApproved ? 'onaylandi' : 'bekliyor',
      tcKimlik: profile.tcKimlik || '',
      phone: profile.phone || '',
      address: profile.address || '',
      email: profile.email || '',
      neighborhood: profile.neighborhood || '',
      createdAt: new Date().toISOString(),
    }
    const next = [...current, newTalep]
    writeMahalleliTalepler(next)
    setTalepler(next)
    return newTalep
  }, [])

  const onaylaTalep = useCallback(async (id) => {
    const current = readMahalleliTalepler()
    const target = current.find((item) => item.id === id)
    const next = current.map((item) => (item.id === id ? { ...item, durum: 'onaylandi' } : item))
    writeMahalleliTalepler(next)
    setTalepler(next)
    if (target?.tcKimlik) {
      try {
        await setProfileApproved(target.tcKimlik, true)
      } catch (error) {
        console.warn('[Mahalleli] onay uzak servise yazılamadı', error)
      }
      window.dispatchEvent(
        new CustomEvent('mahalleli-beneficiary-approved', { detail: { tcKimlik: target.tcKimlik } }),
      )
    }
  }, [])

  const bekleyenTalepler = useMemo(
    () => talepler.filter((item) => item.durum === 'bekliyor'),
    [talepler],
  )

  const onaylananTalepler = useMemo(
    () => talepler.filter((item) => item.durum === 'onaylandi'),
    [talepler],
  )

  const getTalepByIsim = useCallback(
    (isim) => findTalepByIsim(talepler, isim),
    [talepler],
  )

  return {
    talepler,
    bekleyenTalepler,
    onaylananTalepler,
    ensureBekleyenTalep,
    onaylaTalep,
    getTalepByIsim,
    syncTalepler,
  }
}
