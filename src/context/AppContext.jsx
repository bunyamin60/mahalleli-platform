import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { AID_PACKAGES } from '../data/aidPackages'

const STORAGE_KEY = 'mahalleli-platform-state-v2'

const initialState = {
  users: [],
  sessions: {
    donor: null,
    beneficiary: null,
    merchant: null,
    municipality: null,
  },
  carts: {},
  requests: [],
  message: '',
}

const AppContext = createContext(null)

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return initialState
    }
    const parsed = JSON.parse(raw)
    const migratedUsers =
      parsed.users ||
      Object.entries(parsed.accounts || {}).flatMap(([role, list]) =>
        (list || []).map((user) => ({
          ...user,
          role,
        })),
      )
    const normalizedUsers = (migratedUsers || []).map((user) => {
      if (user.role !== 'merchant') {
        return user
      }
      const inv = user.availablePackages || user.inventory || []
      if (Array.isArray(inv) && inv.length && typeof inv[0] === 'string') {
        return {
          ...user,
          inventory: inv.map((packageId) => ({ packageId, stock: 50 })),
          availablePackages: undefined,
        }
      }
      if (Array.isArray(inv) && inv.length && typeof inv[0] === 'object') {
        return {
          ...user,
          inventory: inv.map((item) => ({ packageId: item.packageId, stock: Number(item.stock) || 0 })),
          availablePackages: undefined,
        }
      }
      return { ...user, inventory: [], availablePackages: undefined }
    })
    return { ...initialState, ...parsed, users: normalizedUsers }
  } catch {
    return initialState
  }
}

export function AppProvider({ children }) {
  const [state, setState] = useState(readStorage)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const setMessage = (message) => {
    setState((current) => ({ ...current, message }))
  }

  const register = (role, form) => {
    const exists = state.users.some((user) => user.role === role && user.name === form.name)
    if (exists) {
      toast.error('Bu rol için aynı ad ile kayıtlı kullanıcı zaten var.', { autoClose: 2400 })
      return { ok: false }
    }

    const newUser = {
      ...form,
      role,
      neighborhood: form.neighborhood,
      inventory: role === 'merchant' ? (form.inventory || []).map((i) => ({ packageId: i.packageId, stock: Number(i.stock) || 0 })) : [],
    }
    setState((current) => ({
      ...current,
      users: [...current.users, newUser],
      message: `${form.name} kaydedildi. Şimdi giriş yapabilirsiniz.`,
    }))
    return { ok: true }
  }

  const login = (role, form) => {
    const found = state.users.find(
      (item) => item.role === role && item.name === form.name && item.password === form.password,
    )
    if (!found) {
      setMessage('Giriş başarısız. Bilgileri kontrol edin.')
      return { ok: false }
    }
    setState((current) => ({
      ...current,
      sessions: { ...current.sessions, [role]: found },
      message: `${found.name} ile ${role} paneline giriş yapıldı.`,
    }))
    return { ok: true, user: found }
  }

  const addPackageToCart = (beneficiaryName, packageId) => {
    setState((current) => {
      const currentCart = current.carts[beneficiaryName] || []
      const pkg = AID_PACKAGES.find((item) => item.id === packageId)
      if (pkg) {
        toast.success(`${pkg.name} sepete eklendi`, { autoClose: 1800 })
      }
      return {
        ...current,
        carts: { ...current.carts, [beneficiaryName]: [...currentCart, packageId] },
        message: 'Paket sepete eklendi.',
      }
    })
  }

  const removePackageFromCart = (beneficiaryName, packageId) => {
    setState((current) => {
      const currentCart = current.carts[beneficiaryName] || []
      const removeIndex = currentCart.lastIndexOf(packageId)
      if (removeIndex < 0) {
        return current
      }
      const nextCart = [...currentCart]
      nextCart.splice(removeIndex, 1)
      return {
        ...current,
        carts: { ...current.carts, [beneficiaryName]: nextCart },
        message: 'Paket adedi azaltıldı.',
      }
    })
  }

  const deletePackageFromCart = (beneficiaryName, packageId) => {
    setState((current) => {
      const currentCart = current.carts[beneficiaryName] || []
      const nextCart = currentCart.filter((id) => id !== packageId)
      return {
        ...current,
        carts: { ...current.carts, [beneficiaryName]: nextCart },
        message: 'Paket sepetten kaldırıldı.',
      }
    })
  }

  const submitAidRequest = (beneficiaryName) => {
    let requestCreated = false
    setState((current) => {
      const cart = current.carts[beneficiaryName] || []
      if (!cart.length) {
        return { ...current, message: 'Sepet boş. Önce paket ekleyin.' }
      }

      const packageIds = cart
      const packageDetails = packageIds
        .map((id) => AID_PACKAGES.find((item) => item.id === id))
        .filter(Boolean)
      const totalAmount = packageDetails.reduce((sum, item) => sum + item.price, 0)
      const totalValue = packageDetails.reduce(
        (sum, item) => sum + item.items.reduce((acc, product) => acc + product.quantity * product.unitPrice, 0),
        0,
      )

      const newRequest = {
        id: crypto.randomUUID(),
        beneficiaryName,
        packageIds,
        totalAmount,
        totalValue,
        status: 'requested',
        donorName: null,
        qrCode: null,
        createdAt: new Date().toISOString(),
      }
      requestCreated = true

      return {
        ...current,
        requests: [newRequest, ...current.requests],
        carts: { ...current.carts, [beneficiaryName]: [] },
        message: 'Yardım talebi başarıyla oluşturuldu.',
      }
    })
    if (!requestCreated) {
      toast.error('Hata: Sepetiniz bos! Lutfen talebinizi olusturmadan once paket ekleyin.', {
        autoClose: 2600,
      })
      return
    }
    toast.success('Yardım talebi oluşturuldu', { autoClose: 2200 })
  }

  const fundRequest = (requestId, donorName, merchantName) => {
    setState((current) => {
      const target = current.requests.find((item) => item.id === requestId)
      if (!target || target.status !== 'requested') {
        return { ...current, message: 'Talep artık fonlanamıyor.' }
      }
      const merchant = current.users.find((user) => user.role === 'merchant' && user.name === merchantName)
      if (!merchant) {
        toast.error('Lutfen once bir market secin.', { autoClose: 2200 })
        return { ...current, message: 'Market secimi gerekli.' }
      }
      const needed = target.packageIds.reduce((acc, packageId) => {
        acc[packageId] = (acc[packageId] || 0) + 1
        return acc
      }, {})
      const merchantInventory = merchant.inventory || []
      const hasAllStock = Object.entries(needed).every(([packageId, qty]) => {
        const row = merchantInventory.find((i) => i.packageId === packageId)
        return (row?.stock || 0) >= qty
      })
      if (!hasAllStock) {
        toast.error('Secili markette stok yetersiz (tukenmis olabilir).', { autoClose: 2400 })
        return { ...current, message: 'Market stok yetersiz.' }
      }

      const qrCode = `MHL-REQ-${requestId.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`
      return {
        ...current,
        requests: current.requests.map((item) =>
          item.id === requestId
            ? { ...item, status: 'funded', donorName, merchantName, qrCode, fundedAt: new Date().toISOString() }
            : item,
        ),
        users: current.users.map((user) => {
          if (user.role !== 'merchant' || user.name !== merchantName) {
            return user
          }
          const inv = (user.inventory || []).map((row) => {
            const dec = needed[row.packageId] || 0
            if (!dec) {
              return row
            }
            return { ...row, stock: Math.max(0, (Number(row.stock) || 0) - dec) }
          })
          return { ...user, inventory: inv }
        }),
        message: 'Talep fonlandı. İhtiyaç sahibi için QR kod üretildi.',
      }
    })
    toast.success('Ödeme tamamlandı, QR kod üretildi', { autoClose: 2300 })
  }

  const deliverByQr = (qrCode, merchantName) => {
    setState((current) => {
      const target = current.requests.find((item) => item.qrCode === qrCode && item.status === 'funded')
      if (!target) {
        return { ...current, message: 'QR kodu bulunamadı veya işlem zaten teslim edilmiş.' }
      }
      if (target.merchantName && target.merchantName !== merchantName) {
        return { ...current, message: 'Bu QR kod secili markete ait degil.' }
      }

      return {
        ...current,
        requests: current.requests.map((item) =>
          item.id === target.id
            ? { ...item, status: 'delivered', merchantName, deliveredAt: new Date().toISOString() }
            : item,
        ),
        message: `Teslimat tamamlandı: ${target.beneficiaryName}`,
      }
    })
    toast.success('Teslimat tamamlandı', {
      autoClose: 2500,
      icon: '👏',
    })
  }

  const logout = () => {
    setState((current) => ({
      ...current,
      sessions: initialState.sessions,
      message: 'Cikis yapildi.',
    }))
    toast.info('Oturum kapatildi. Rol secim ekranina yonlendiriliyorsunuz.', { autoClose: 1800 })
  }

  const updateMerchantInventory = (merchantName, inventory) => {
    setState((current) => ({
      ...current,
      users: current.users.map((user) =>
        user.role === 'merchant' && user.name === merchantName
          ? { ...user, inventory: inventory.map((i) => ({ packageId: i.packageId, stock: Number(i.stock) || 0 })) }
          : user,
      ),
      sessions: {
        ...current.sessions,
        merchant:
          current.sessions.merchant?.name === merchantName
            ? { ...current.sessions.merchant, inventory: inventory.map((i) => ({ packageId: i.packageId, stock: Number(i.stock) || 0 })) }
            : current.sessions.merchant,
      },
      message: 'Esnaf stok listesi guncellendi.',
    }))
  }

  const value = useMemo(
    () => ({
      ...state,
      aidPackages: AID_PACKAGES,
      register,
      login,
      setMessage,
      addPackageToCart,
      removePackageFromCart,
      deletePackageFromCart,
      submitAidRequest,
      fundRequest,
      deliverByQr,
      logout,
      updateMerchantInventory,
    }),
    [state],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider')
  }
  return context
}
