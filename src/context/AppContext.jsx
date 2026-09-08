import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { canMerchantSellProduct } from '../data/merchantTypes'
import { COURIER_FEE, PRODUCTS, getProductById } from '../data/products'
import { mergeDemoElderlySeed } from '../data/demoElderlyCitizens'
import { canonicalName, collapseMerchantDuplicates, findBySanitizedName, namesMatch } from '../utils/matchers'
import {
  fetchMerchantOrders,
  fetchOrders,
  fetchPoolBalanceRemote,
  fetchProfiles,
  findProfileByEmail,
  findProfileByTc,
  insertOrder,
  persistPoolFundingSideEffects,
  setProfileApproved,
  subscribeRealtime,
  updateMerchantInventoryRemote,
  updateOrderRemote,
  upsertProfile,
  writePoolBalanceRemote,
} from '../services/dataService'
import {
  buildFundedRequestUpdate,
  deductMerchantStock,
  processPoolAutoFunding,
  readPoolBalance,
  writePoolBalance,
} from '../utils/poolFunding'

const STORAGE_KEY = 'mahalleli-platform-state-v4'

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

function migrateInventory(inv = []) {
  if (!Array.isArray(inv) || !inv.length) {
    return []
  }
  return inv.map((row) => ({
    productId: row.productId || row.packageId,
    stock: Number(row.stock) || 0,
  }))
}

function migrateRequest(request) {
  const productIds = request.productIds || request.packageIds || []
  return {
    ...request,
    productIds,
    packageIds: undefined,
    deliveryMethod: request.deliveryMethod || 'pickup',
    courierFee: request.courierFee ?? (request.deliveryMethod === 'courier' ? COURIER_FEE : 0),
    productTotal: request.productTotal ?? request.totalAmount - (request.courierFee || 0),
  }
}

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return mergeDemoElderlySeed(initialState)
    }
    const parsed = JSON.parse(raw)
    const migratedUsers = (parsed.users || []).map((user) => {
      if (user.role !== 'merchant') {
        return {
          ...user,
          isApproved: user.role === 'beneficiary' ? Boolean(user.isApproved || user.municipalityApproved) : true,
        }
      }
      return {
        ...user,
        merchantType: user.merchantType || 'market',
        inventory: migrateInventory(user.inventory || user.availablePackages),
        availablePackages: undefined,
      }
    })
    const requests = (parsed.requests || []).map(migrateRequest)
    return collapseMerchantDuplicates(
      mergeDemoElderlySeed({ ...initialState, ...parsed, users: migratedUsers, requests }),
    )
  } catch {
    return collapseMerchantDuplicates(mergeDemoElderlySeed(initialState))
  }
}

function userKey(user) {
  return `${user.role}:${user.tcKimlik || user.email || user.id}`
}

function mergeUsers(localUsers, remoteUsers) {
  if (!remoteUsers) {
    return collapseMerchantDuplicates(localUsers)
  }
  const map = new Map()
  for (const user of localUsers) {
    map.set(userKey(user), user)
  }
  for (const remote of remoteUsers) {
    const key = userKey(remote)
    const local = map.get(key)
    map.set(
      key,
      local
        ? { ...local, ...remote, inventory: remote.inventory?.length ? remote.inventory : local.inventory }
        : remote,
    )
  }
  return collapseMerchantDuplicates([...map.values()], remoteUsers)
}

const STATUS_RANK = {
  requested: 0,
  funded: 1,
  courier_dispatched: 2,
  delivered: 3,
}

function mergeRequests(localRequests, remoteRequests) {
  if (!remoteRequests) {
    return localRequests
  }
  const map = new Map()
  for (const request of localRequests) {
    map.set(request.id, request)
  }
  for (const remote of remoteRequests) {
    const local = map.get(remote.id)
    if (!local) {
      map.set(remote.id, remote)
      continue
    }
    const localRank = STATUS_RANK[local.status] ?? 0
    const remoteRank = STATUS_RANK[remote.status] ?? 0
    map.set(remote.id, localRank > remoteRank ? { ...remote, ...local } : { ...local, ...remote })
  }
  return [...map.values()].map(migrateRequest)
}

function buildCartItems(productIds) {
  return productIds.map((productId) => {
    const product = getProductById(productId)
    return {
      productId,
      name: product?.name || productId,
      price: product?.price || 0,
      qty: 1,
    }
  })
}

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, setState] = useState(readStorage)
  const [poolBalance, setPoolBalance] = useState(readPoolBalance)
  const stateRef = useRef(state)
  stateRef.current = state

  const persistLocal = useCallback((nextState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
    } catch (error) {
      console.warn('[Mahalleli] localStorage yazılamadı', error)
    }
  }, [])

  const syncPoolBalance = useCallback((nextValue) => {
    if (Number.isFinite(nextValue)) {
      writePoolBalance(nextValue)
      setPoolBalance(nextValue)
      return
    }
    setPoolBalance(readPoolBalance())
  }, [])

  const applyPoolFunding = useCallback(
    (current, poolOverride) => {
      const result = processPoolAutoFunding(current, poolOverride)
      if (!result) {
        return current
      }
      syncPoolBalance(result.poolBalance)
      void persistPoolFundingSideEffects(result)
      return result.state
    },
    [syncPoolBalance],
  )

  const hydrateFromRemote = useCallback(async () => {
    try {
      const [remoteUsers, remoteOrders, remotePool] = await Promise.all([
        fetchProfiles(),
        fetchOrders(),
        fetchPoolBalanceRemote(),
      ])
      const current = stateRef.current
      const users = mergeUsers(current.users, remoteUsers)
      const requests = mergeRequests(current.requests, remoteOrders)
      const nextState = {
        ...current,
        users,
        requests,
        sessions: Object.fromEntries(
          Object.entries(current.sessions).map(([role, session]) => {
            if (!session) {
              return [role, session]
            }
            const fresh = users.find((user) => user.role === role && user.tcKimlik === session.tcKimlik)
            return [role, fresh || session]
          }),
        ),
      }
      setState(nextState)
      if (Number.isFinite(remotePool)) {
        syncPoolBalance(remotePool)
      }
      window.dispatchEvent(new CustomEvent('mahalleli-users-hydrated', { detail: { users } }))
      setState((latest) => applyPoolFunding(latest, Number.isFinite(remotePool) ? remotePool : readPoolBalance()))
    } catch (error) {
      console.warn('[Mahalleli] uzak veri yüklenemedi, yerel yedek kullanılıyor', error)
    }
  }, [applyPoolFunding, syncPoolBalance])

  useEffect(() => {
    persistLocal(state)
  }, [state, persistLocal])

  useEffect(() => {
    syncPoolBalance()
    const onPoolUpdate = () => syncPoolBalance()
    const onStorage = (event) => {
      if (event.key === 'mahalleli_pool_balance') {
        syncPoolBalance()
      }
    }
    window.addEventListener('mahalleli-pool-updated', onPoolUpdate)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('mahalleli-pool-updated', onPoolUpdate)
      window.removeEventListener('storage', onStorage)
    }
  }, [syncPoolBalance])

  useEffect(() => {
    const onApproved = (event) => {
      const tcKimlik = event.detail?.tcKimlik
      if (!tcKimlik) {
        return
      }
      setState((current) => ({
        ...current,
        users: current.users.map((user) =>
          user.role === 'beneficiary' && user.tcKimlik === tcKimlik
            ? { ...user, isApproved: true, municipalityApproved: true }
            : user,
        ),
        sessions: {
          ...current.sessions,
          beneficiary:
            current.sessions.beneficiary?.tcKimlik === tcKimlik
              ? { ...current.sessions.beneficiary, isApproved: true, municipalityApproved: true }
              : current.sessions.beneficiary,
        },
      }))
    }
    window.addEventListener('mahalleli-beneficiary-approved', onApproved)
    return () => window.removeEventListener('mahalleli-beneficiary-approved', onApproved)
  }, [])

  useEffect(() => {
    void hydrateFromRemote()
    const unsubscribe = subscribeRealtime(() => {
      void hydrateFromRemote()
    })
    return unsubscribe
  }, [hydrateFromRemote])

  const runPoolAutoFunding = useCallback(() => {
    setState((current) => applyPoolFunding(current, readPoolBalance()))
  }, [applyPoolFunding])

  const setMessage = (message) => {
    setState((current) => ({ ...current, message }))
  }

  const register = async (role, form) => {
    try {
      const email = String(form.email || '').trim().toLocaleLowerCase('tr-TR')
      if (!email || !email.includes('@')) {
        toast.error('Geçerli bir e-posta adresi girin.', { autoClose: 2400 })
        return { ok: false }
      }

      const tc = String(form.tcKimlik || '').replace(/\D/g, '')
      if (tc.length !== 11) {
        toast.error('Geçerli bir 11 haneli T.C. kimlik numarası girin.', { autoClose: 2400 })
        return { ok: false }
      }

      const [remoteByEmail, remoteByTc] = await Promise.all([
        findProfileByEmail(role, email),
        findProfileByTc(role, tc),
      ])
      const localUsers = stateRef.current.users
      const emailExists =
        Boolean(remoteByEmail) ||
        localUsers.some(
          (user) => user.role === role && String(user.email || '').toLocaleLowerCase('tr-TR') === email,
        )
      if (emailExists) {
        toast.error('Bu e-posta ile aynı rolde kayıtlı kullanıcı zaten var.', { autoClose: 2400 })
        return { ok: false }
      }
      const tcExists =
        Boolean(remoteByTc) || localUsers.some((user) => user.role === role && user.tcKimlik === tc)
      if (tcExists) {
        toast.error('Bu T.C. kimlik numarası ile aynı rolde kayıtlı kullanıcı zaten var.', { autoClose: 2400 })
        return { ok: false }
      }

      if (role === 'merchant' && !form.merchantType) {
        toast.error('Lütfen işletme tipini seçin.', { autoClose: 2200 })
        return { ok: false }
      }
      if (role === 'municipality' && !form.unit) {
        toast.error('Lütfen belediye birimini seçin.', { autoClose: 2200 })
        return { ok: false }
      }
      if (role === 'municipality' && (!form.city || !form.district)) {
        toast.error('Lütfen il ve ilçe seçin.', { autoClose: 2200 })
        return { ok: false }
      }
      if (role !== 'municipality' && !form.neighborhood) {
        toast.error('Lütfen mahalle seçin.', { autoClose: 2200 })
        return { ok: false }
      }

      let phone = form.phone
      if (role !== 'municipality') {
        const digits = String(form.phone || '').replace(/\D/g, '')
        phone = digits.startsWith('0') ? digits.slice(0, 11) : `0${digits}`.slice(0, 11)
        if (phone.length !== 11 || !phone.startsWith('05')) {
          toast.error('Geçerli bir cep telefonu girin (05XXXXXXXXX).', { autoClose: 2400 })
          return { ok: false }
        }
      }

      const newUser = {
        ...form,
        id: crypto.randomUUID(),
        email,
        tcKimlik: tc,
        phone: role === 'municipality' ? undefined : phone,
        role,
        neighborhood: role === 'municipality' ? undefined : form.neighborhood,
        city: role === 'municipality' ? form.city : undefined,
        district: role === 'municipality' ? form.district : undefined,
        unit: role === 'municipality' ? form.unit : undefined,
        merchantType: role === 'merchant' ? form.merchantType : undefined,
        isApproved: role !== 'beneficiary',
        inventory:
          role === 'merchant'
            ? (form.inventory || []).map((i) => ({
                productId: i.productId,
                stock: Number(i.stock) || 0,
              }))
            : [],
      }

      const saved = (await upsertProfile(newUser)) || newUser
      setState((current) => ({
        ...current,
        users: [...current.users, saved],
        message: `${form.name} kaydedildi. E-posta ile giriş yapabilirsiniz.`,
      }))
      return { ok: true, user: saved }
    } catch (error) {
      console.warn('[Mahalleli] kayıt uzak servise yazılamadı', error)
      toast.error('Kayıt sırasında bağlantı sorunu oluştu. Yerel kayıt denendi.', { autoClose: 2600 })
      return { ok: false }
    }
  }

  const login = async (role, form) => {
    try {
      const email = String(form.email || '').trim().toLocaleLowerCase('tr-TR')
      let found = await findProfileByEmail(role, email)
      if (found && found.password !== form.password) {
        setMessage('Giriş başarısız. E-posta ve parolayı kontrol edin.')
        toast.error('Giriş başarısız. E-posta ve parolayı kontrol edin.', { autoClose: 2400 })
        return { ok: false }
      }
      if (!found) {
        found = stateRef.current.users.find(
          (item) =>
            item.role === role &&
            String(item.email || '').toLocaleLowerCase('tr-TR') === email &&
            item.password === form.password,
        )
      }
      if (!found) {
        const byTc = String(form.tcKimlik || '').replace(/\D/g, '')
        if (byTc.length === 11) {
          found = (await findProfileByTc(role, byTc)) ||
            stateRef.current.users.find((item) => item.role === role && item.tcKimlik === byTc)
          if (found && found.password !== form.password) {
            found = null
          }
        }
      }
      if (!found) {
        setMessage('Giriş başarısız. E-posta ve parolayı kontrol edin.')
        toast.error('Giriş başarısız. E-posta ve parolayı kontrol edin.', { autoClose: 2400 })
        return { ok: false }
      }

      setState((current) => {
        const exists = current.users.some((user) => userKey(user) === userKey(found))
        return {
          ...current,
          users: exists
            ? current.users.map((user) => (userKey(user) === userKey(found) ? { ...user, ...found } : user))
            : [...current.users, found],
          sessions: { ...current.sessions, [role]: found },
          message: `${found.name} ile ${role} paneline giriş yapıldı.`,
        }
      })
      return { ok: true, user: found }
    } catch (error) {
      console.warn('[Mahalleli] giriş sorgusu başarısız, yerel yedek deneniyor', error)
      const email = String(form.email || '').trim().toLocaleLowerCase('tr-TR')
      const found = stateRef.current.users.find(
        (item) =>
          item.role === role &&
          String(item.email || '').toLocaleLowerCase('tr-TR') === email &&
          item.password === form.password,
      )
      if (!found) {
        toast.error('Giriş başarısız. E-posta ve parolayı kontrol edin.', { autoClose: 2400 })
        return { ok: false }
      }
      setState((current) => ({
        ...current,
        sessions: { ...current.sessions, [role]: found },
        message: `${found.name} ile ${role} paneline giriş yapıldı.`,
      }))
      return { ok: true, user: found }
    }
  }

  const addProductToCart = (beneficiaryName, productId) => {
    setState((current) => {
      const currentCart = current.carts[beneficiaryName] || []
      if (currentCart.includes(productId)) {
        toast.info('Her üründen en fazla 1 adet ekleyebilirsiniz.', { autoClose: 2200 })
        return current
      }
      const product = getProductById(productId)
      if (product) {
        toast.success(`${product.name} sepete eklendi`, { autoClose: 1800 })
      }
      return {
        ...current,
        carts: { ...current.carts, [beneficiaryName]: [...currentCart, productId] },
        message: 'Ürün sepete eklendi.',
      }
    })
  }

  const removeProductFromCart = (beneficiaryName, productId) => {
    setState((current) => {
      const currentCart = current.carts[beneficiaryName] || []
      const nextCart = currentCart.filter((id) => id !== productId)
      return {
        ...current,
        carts: { ...current.carts, [beneficiaryName]: nextCart },
        message: 'Ürün sepetten kaldırıldı.',
      }
    })
  }

  const submitAidRequest = (beneficiaryName, deliveryMethod, merchantName) => {
    let createdRequest = null
    setState((current) => {
      const cart = current.carts[beneficiaryName] || []
      if (!cart.length) {
        return { ...current, message: 'Sepet boş. Önce ürün ekleyin.' }
      }
      if (!merchantName) {
        return { ...current, message: 'Lütfen esnaf seçin.' }
      }

      const productIds = [...cart]
      const productDetails = productIds.map((id) => getProductById(id)).filter(Boolean)
      const productTotal = productDetails.reduce((sum, item) => sum + item.price, 0)
      const courierFee = deliveryMethod === 'courier' ? COURIER_FEE : 0
      const totalAmount = productTotal + courierFee

      const merchant = findBySanitizedName(
        current.users.filter((user) => user.role === 'merchant'),
        merchantName,
      )
      const resolvedMerchantName = merchant?.name || canonicalName(merchantName)
      const hasStock = productIds.every((productId) => {
        const row = (merchant?.inventory || []).find((item) => item.productId === productId)
        return (row?.stock || 0) >= 1
      })
      if (!hasStock) {
        toast.error('Seçili esnafta stok yetersiz.', { autoClose: 2400 })
        return { ...current, message: 'Esnaf stok yetersiz.' }
      }

      const beneficiary = current.users.find(
        (item) => item.role === 'beneficiary' && item.name === beneficiaryName,
      )
      const newRequest = {
        id: crypto.randomUUID(),
        beneficiaryName,
        beneficiaryTc: beneficiary?.tcKimlik || null,
        productIds,
        items: buildCartItems(productIds),
        productTotal,
        courierFee,
        deliveryMethod,
        totalAmount,
        status: 'requested',
        donorName: null,
        merchantName: resolvedMerchantName,
        merchantType: merchant?.merchantType || null,
        qrCode: null,
        createdAt: new Date().toISOString(),
      }
      createdRequest = newRequest

      return {
        ...current,
        requests: [newRequest, ...current.requests],
        carts: { ...current.carts, [beneficiaryName]: [] },
        message: 'Yardım talebi başarıyla oluşturuldu.',
      }
    })
    if (!createdRequest) {
      toast.error('Talep oluşturulamadı. Sepet ve esnaf seçimini kontrol edin.', { autoClose: 2600 })
      return
    }
    toast.success('Yardım talebi oluşturuldu', { autoClose: 2200 })
    void insertOrder(createdRequest).then((saved) => {
      if (saved?.id && saved.id !== createdRequest.id) {
        setState((current) => ({
          ...current,
          requests: current.requests.map((item) => (item.id === createdRequest.id ? { ...item, ...saved } : item)),
        }))
      }
    })
  }

  const fundRequest = (requestId, donorName, merchantName) => {
    let persisted = null
    setState((current) => {
      const target = current.requests.find((item) => item.id === requestId)
      if (!target || target.status !== 'requested') {
        return { ...current, message: 'Talep artık fonlanamıyor.' }
      }
      const merchant = findBySanitizedName(
        current.users.filter((user) => user.role === 'merchant'),
        merchantName,
      )
      const resolvedMerchantName = merchant?.name || canonicalName(merchantName)
      if (!merchant) {
        toast.error('Lütfen önce bir esnaf seçin.', { autoClose: 2200 })
        return { ...current, message: 'Esnaf seçimi gerekli.' }
      }
      const needed = target.productIds.reduce((acc, productId) => {
        acc[productId] = (acc[productId] || 0) + 1
        return acc
      }, {})
      const hasAllStock = Object.entries(needed).every(([productId, qty]) => {
        const row = (merchant.inventory || []).find((i) => i.productId === productId)
        return (row?.stock || 0) >= qty
      })
      if (!hasAllStock) {
        toast.error('Seçili esnafta stok yetersiz.', { autoClose: 2400 })
        return { ...current, message: 'Esnaf stok yetersiz.' }
      }

      const updated = buildFundedRequestUpdate(target, resolvedMerchantName, donorName)
      const nextUsers = deductMerchantStock(current.users, resolvedMerchantName, target.productIds)
      persisted = {
        request: { ...updated, merchantType: merchant.merchantType || updated.merchantType },
        merchant: nextUsers.find((user) => user.role === 'merchant' && namesMatch(user.name, resolvedMerchantName)),
      }

      return {
        ...current,
        requests: current.requests.map((item) => (item.id === requestId ? persisted.request : item)),
        users: nextUsers,
        message: 'Talep fonlandı.',
      }
    })
    if (persisted) {
      void updateOrderRemote(requestId, {
        status: 'funded',
        donorName,
        merchantName,
        merchantType: persisted.request.merchantType,
        qrCode: persisted.request.qrCode,
        fundedAt: persisted.request.fundedAt,
      })
      if (persisted.merchant) {
        void updateMerchantInventoryRemote(
          persisted.merchant.tcKimlik,
          persisted.merchant.name,
          persisted.merchant.inventory || [],
        )
      }
      toast.success('Ödeme tamamlandı', { autoClose: 2300 })
    }
  }

  const donateToPool = async (amount) => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      return
    }
    try {
      const remote = await fetchPoolBalanceRemote()
      const currentBalance = Number.isFinite(remote) ? remote : readPoolBalance()
      const next = currentBalance + value
      writePoolBalance(next)
      setPoolBalance(next)
      void writePoolBalanceRemote(next)
      setState((current) => {
        const funded = applyPoolFunding(
          { ...current, message: `${value} TL genel havuza aktarıldı.` },
          next,
        )
        return funded
      })
      toast.success(`${value} TL genel havuza bağışlandı`, { autoClose: 2200 })
    } catch (error) {
      console.warn('[Mahalleli] havuz bağışı uzak servise yazılamadı', error)
      const next = readPoolBalance() + value
      writePoolBalance(next)
      setPoolBalance(next)
      setState((current) => applyPoolFunding({ ...current, message: `${value} TL genel havuza aktarıldı.` }, next))
      toast.success(`${value} TL genel havuza bağışlandı`, { autoClose: 2200 })
    }
  }

  const deliverByQr = (qrCode, merchantName) => {
    let deliveredId = null
    setState((current) => {
      const target = current.requests.find(
        (item) =>
          item.qrCode === qrCode &&
          item.status === 'funded' &&
          item.deliveryMethod === 'pickup',
      )
      if (!target) {
        return { ...current, message: 'QR kodu bulunamadı veya işlem zaten teslim edilmiş.' }
      }
      if (target.merchantName && !namesMatch(target.merchantName, merchantName)) {
        return { ...current, message: 'Bu QR kod seçili esnafa ait değil.' }
      }
      deliveredId = target.id
      const deliveredAt = new Date().toISOString()
      return {
        ...current,
        requests: current.requests.map((item) =>
          item.id === target.id
            ? { ...item, status: 'delivered', merchantName, deliveredAt }
            : item,
        ),
        message: `Teslimat tamamlandı: ${target.beneficiaryName}`,
      }
    })
    if (deliveredId) {
      void updateOrderRemote(deliveredId, {
        status: 'delivered',
        merchantName,
        deliveredAt: new Date().toISOString(),
      })
      toast.success('Teslimat tamamlandı', { autoClose: 2500, icon: '👏' })
    }
  }

  const handoffToCourier = (requestId, merchantName) => {
    let ok = false
    setState((current) => {
      const target = current.requests.find(
        (item) =>
          item.id === requestId &&
          item.status === 'funded' &&
          item.deliveryMethod === 'courier' &&
          namesMatch(item.merchantName, merchantName),
      )
      if (!target) {
        return { ...current, message: 'Kurye siparişi bulunamadı.' }
      }
      ok = true
      const courierHandoffAt = new Date().toISOString()
      return {
        ...current,
        requests: current.requests.map((item) =>
          item.id === requestId
            ? { ...item, status: 'courier_dispatched', courierHandoffAt }
            : item,
        ),
        message: `Sipariş kuryeye verildi: ${target.beneficiaryName}`,
      }
    })
    if (ok) {
      void updateOrderRemote(requestId, {
        status: 'courier_dispatched',
        merchantName,
        courierHandoffAt: new Date().toISOString(),
      })
      toast.success('Sipariş kuryeye verildi', { autoClose: 2300 })
    }
  }

  const logout = () => {
    setState((current) => ({
      ...current,
      sessions: initialState.sessions,
      message: 'Çıkış yapıldı.',
    }))
    toast.info('Oturum kapatıldı.', { autoClose: 1800 })
  }

  const deliverByTc = (tcKimlik, merchantName) => {
    let deliveredId = null
    setState((current) => {
      const beneficiary = current.users.find(
        (item) => item.role === 'beneficiary' && item.tcKimlik === tcKimlik,
      )
      if (!beneficiary) {
        return { ...current, message: 'Bu T.C. ile kayıtlı ihtiyaç sahibi bulunamadı.' }
      }
      const target = current.requests.find(
        (item) =>
          item.beneficiaryName === beneficiary.name &&
          item.status === 'funded' &&
          item.deliveryMethod === 'pickup' &&
          (!item.merchantName || namesMatch(item.merchantName, merchantName)),
      )
      if (!target) {
        return { ...current, message: 'Bu vatandaş için teslimata hazır fonlanmış sipariş bulunamadı.' }
      }
      deliveredId = target.id
      const deliveredAt = new Date().toISOString()
      return {
        ...current,
        requests: current.requests.map((item) =>
          item.id === target.id
            ? { ...item, status: 'delivered', merchantName, deliveredAt }
            : item,
        ),
        message: `Teslimat tamamlandı: ${target.beneficiaryName}`,
      }
    })
    if (deliveredId) {
      void updateOrderRemote(deliveredId, {
        status: 'delivered',
        merchantName,
        deliveredAt: new Date().toISOString(),
      })
      toast.success('Teslimat tamamlandı', { autoClose: 2500, icon: '👏' })
    }
  }

  const createProxyAidRequest = (tcKimlik, productId, merchantName) => {
    let createdRequest = null
    setState((current) => {
      const beneficiary = current.users.find(
        (item) => item.role === 'beneficiary' && item.tcKimlik === tcKimlik,
      )
      if (!beneficiary) {
        return { ...current, message: 'Bu T.C. ile kayıtlı ihtiyaç sahibi bulunamadı.' }
      }
      const hasActive = current.requests.some(
        (item) =>
          item.beneficiaryName === beneficiary.name && ['requested', 'funded'].includes(item.status),
      )
      if (hasActive) {
        return { ...current, message: 'Bu vatandaş için zaten aktif bir yardım talebi var.' }
      }
      const product = getProductById(productId)
      if (!product) {
        return { ...current, message: 'Geçersiz ürün seçimi.' }
      }
      const merchant = findBySanitizedName(
        current.users.filter((user) => user.role === 'merchant'),
        merchantName,
      )
      const resolvedMerchantName = merchant?.name || canonicalName(merchantName)

      const newRequest = {
        id: crypto.randomUUID(),
        beneficiaryName: beneficiary.name,
        beneficiaryTc: tcKimlik,
        productIds: [productId],
        items: buildCartItems([productId]),
        productTotal: product.price,
        courierFee: 0,
        deliveryMethod: 'pickup',
        totalAmount: product.price,
        status: 'requested',
        donorName: null,
        merchantName: resolvedMerchantName,
        merchantType: merchant?.merchantType || null,
        qrCode: null,
        proxyCreatedBy: resolvedMerchantName,
        createdAt: new Date().toISOString(),
      }
      createdRequest = newRequest
      return {
        ...current,
        requests: [newRequest, ...current.requests],
        message: `${beneficiary.name} adına bağış bekleyen talep oluşturuldu.`,
      }
    })
    if (createdRequest) {
      toast.success('Teyze adına talep oluşturuldu — bağış bekleniyor', { autoClose: 2600 })
      void insertOrder(createdRequest)
    }
  }

  const updateMerchantInventory = (merchantName, inventory) => {
    const normalized = inventory.map((i) => ({
      productId: i.productId,
      stock: Number(i.stock) || 0,
    }))
    let merchant = null
    setState((current) => {
      merchant = findBySanitizedName(
        current.users.filter((user) => user.role === 'merchant'),
        merchantName,
      )
      return {
        ...current,
        users: current.users.map((user) =>
          user.role === 'merchant' && namesMatch(user.name, merchantName)
            ? { ...user, inventory: normalized }
            : user,
        ),
        sessions: {
          ...current.sessions,
          merchant:
            current.sessions.merchant && namesMatch(current.sessions.merchant.name, merchantName)
              ? { ...current.sessions.merchant, inventory: normalized }
              : current.sessions.merchant,
        },
        message: 'Esnaf stok listesi güncellendi.',
      }
    })
    void updateMerchantInventoryRemote(merchant?.tcKimlik, merchantName, normalized)
  }

  const refreshMerchantOrders = useCallback(async (merchantType, merchantName) => {
    try {
      const remote = await fetchMerchantOrders(merchantType, merchantName)
      if (!remote) {
        return
      }
      setState((current) => ({
        ...current,
        requests: mergeRequests(current.requests, remote),
      }))
    } catch (error) {
      console.warn('[Mahalleli] esnaf siparişleri alınamadı', error)
    }
  }, [])

  const approveBeneficiaryRemote = useCallback(async (tcKimlik) => {
    await setProfileApproved(tcKimlik, true)
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      products: PRODUCTS,
      poolBalance,
      register,
      login,
      setMessage,
      addProductToCart,
      removeProductFromCart,
      submitAidRequest,
      fundRequest,
      donateToPool,
      deliverByQr,
      handoffToCourier,
      deliverByTc,
      createProxyAidRequest,
      logout,
      updateMerchantInventory,
      canMerchantSellProduct,
      runPoolAutoFunding,
      refreshMerchantOrders,
      approveBeneficiaryRemote,
    }),
    [state, poolBalance, runPoolAutoFunding, refreshMerchantOrders, approveBeneficiaryRemote],
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
