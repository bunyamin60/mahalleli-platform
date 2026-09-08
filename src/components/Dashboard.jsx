import QRSimulator from './QRSimulator'
import { ROLES } from '../data/roles'
import { useAppContext } from '../context/AppContext'
import { useEffect, useMemo, useState } from 'react'
import {
  formatTalepKuyrukMetni,
  formatTalepOnayMetni,
  useMahalleliTalepler,
} from '../hooks/useMahalleliTalepler'
import { getMerchantTypeLabel, canMerchantSellProduct } from '../data/merchantTypes'
import { COURIER_FEE } from '../data/products'
import { daysSince } from '../utils/poolFunding'
import {
  canApproveBeneficiaries,
  getMunicipalityUnitLabel,
} from '../data/municipalityUnits'
import { CITIES, DEFAULT_CITY, DEFAULT_DISTRICT, NEIGHBORHOODS, getDistrictsForCity } from '../data/locations'
import ProductCard from './ProductCard'
import ProductImage from './ProductImage'
import SearchableSelect from './SearchableSelect'
import { canonicalName, findBySanitizedName, namesMatch, uniqueMerchants, uniqueSelectOptions } from '../utils/matchers'

const CATEGORY_LABELS = {
  'temel-gida': 'Temel Gıda',
  'meyve-sebze': 'Meyve/Sebze',
  kasap: 'Kasap',
}

function Dashboard({ role, user }) {
  const {
    products,
    requests,
    carts,
    users,
    poolBalance,
    addProductToCart,
    removeProductFromCart,
    submitAidRequest,
    fundRequest,
    donateToPool,
    deliverByQr,
    deliverByTc,
    handoffToCourier,
    createProxyAidRequest,
    updateMerchantInventory,
    runPoolAutoFunding,
    refreshMerchantOrders,
    sessions,
  } = useAppContext()
  const [scanCode, setScanCode] = useState('')
  const [activeBeneficiaryTab, setActiveBeneficiaryTab] = useState('market')

  useEffect(() => {
    runPoolAutoFunding()
    if (role === 'merchant' && user) {
      void refreshMerchantOrders?.(user.merchantType || 'market', user.name)
    }
  }, [runPoolAutoFunding, refreshMerchantOrders, role, user])

  if (!user) {
    return (
      <section className="card">
        <h2>Panel Kilitli</h2>
        <p>Bu rol için önce giriş yapın.</p>
      </section>
    )
  }

  const roleLabel = ROLES.find((item) => item.id === role)?.label
  const deliveredCount = requests.filter((item) => item.status === 'delivered').length

  return (
    <section className="card dashboard">
      <div className="card-head">
        <p className="eyebrow">{roleLabel} Paneli</p>
        <h2 className="tracking-tight">Merhaba, {user.name}</h2>
      </div>

      {role === 'donor' && (
        <DonorPanel
          requests={requests}
          products={products}
          donorName={sessions.donor?.name}
          poolBalance={poolBalance}
          onFundRequest={fundRequest}
          onDonateToPool={donateToPool}
          users={users}
        />
      )}
      {role === 'beneficiary' && (
        <BeneficiaryPanel
          user={user}
          products={products}
          requests={requests}
          cart={carts[user.name] || []}
          activeTab={activeBeneficiaryTab}
          onTabChange={setActiveBeneficiaryTab}
          onAddProduct={addProductToCart}
          onRemoveProduct={removeProductFromCart}
          onSubmitRequest={submitAidRequest}
        />
      )}
      {role === 'merchant' && (
        <MerchantPanel
          products={products}
          requests={requests}
          users={users}
          merchantName={user.name}
          merchantType={user.merchantType || 'market'}
          merchantInventory={user.inventory || []}
          onUpdateInventory={updateMerchantInventory}
          onMarkDelivered={deliverByQr}
          onDeliverByTc={deliverByTc}
          onHandoffToCourier={handoffToCourier}
          onCreateProxyRequest={createProxyAidRequest}
          scanCode={scanCode}
          setScanCode={setScanCode}
        />
      )}
      {role === 'municipality' && (
        <MunicipalityPanel
          user={user}
          users={users}
          totalAccounts={Object.values(sessions).filter(Boolean).length}
          requestedCount={requests.filter((item) => item.status === 'requested').length}
          fundedCount={requests.filter((item) => item.status === 'funded').length}
          deliveredCount={deliveredCount}
          poolBalance={poolBalance}
          onRunPoolAutoFunding={runPoolAutoFunding}
        />
      )}
    </section>
  )
}

function DonorPanel({ requests, products, donorName, poolBalance, onFundRequest, onDonateToPool, users }) {
  const donor = users.find((item) => item.role === 'donor' && item.name === donorName)
  const donorNeighborhood = donor?.neighborhood
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(donorNeighborhood || NEIGHBORHOODS[0])
  const [selectedMerchant, setSelectedMerchant] = useState('')

  const merchants = uniqueMerchants(users).filter((item) =>
    (item.inventory || []).some((i) => i.stock > 0),
  )
  const neighborhoodMerchants = uniqueMerchants(
    merchants.filter((item) => item.neighborhood === selectedNeighborhood),
  )
  const alternativeNeighborhoods = [...new Set(merchants.map((item) => item.neighborhood))]
  const selectedMerchantUser = findBySanitizedName(neighborhoodMerchants, selectedMerchant)
  const resolvedMerchantName = selectedMerchantUser?.name || canonicalName(selectedMerchant)
  const openRequests = requests.filter((item) => item.status === 'requested')
  const sortedRequests = openRequests
    .map((request) => {
      const beneficiary = users.find((item) => item.role === 'beneficiary' && item.name === request.beneficiaryName)
      const sameNeighborhood = beneficiary?.neighborhood === donorNeighborhood
      const waitingDays = daysSince(request.createdAt)
      const assignedToSelected =
        !request.merchantName || !resolvedMerchantName || namesMatch(request.merchantName, resolvedMerchantName)
      const canFulfill = selectedMerchantUser
        ? request.productIds.every((productId) =>
            (selectedMerchantUser.inventory || []).some((i) => i.productId === productId && i.stock > 0),
          )
        : false
      return { ...request, beneficiary, sameNeighborhood, waitingDays, assignedToSelected, canFulfill }
    })
    .sort((a, b) => {
      if (resolvedMerchantName) {
        if (Number(b.assignedToSelected) !== Number(a.assignedToSelected)) {
          return Number(b.assignedToSelected) - Number(a.assignedToSelected)
        }
      }
      if (b.waitingDays !== a.waitingDays) {
        return b.waitingDays - a.waitingDays
      }
      return Number(b.sameNeighborhood) - Number(a.sameNeighborhood)
    })

  const neighborhoodOptions = useMemo(() => {
    const fromUsers = users.map((item) => item.neighborhood).filter(Boolean)
    return [...new Set([...NEIGHBORHOODS, ...fromUsers])]
  }, [users])

  const handleMerchantChange = (value) => {
    setSelectedMerchant(canonicalName(value))
  }

  return (
    <div className="stack donor-panel">
      <div className="metric-board">
        <article className="metric-card metric-card--pool">
          <p className="metric-kicker">Genel Bağış Havuzu</p>
          <p className="metric-value">
            {poolBalance}
            <span> TL</span>
          </p>
          <p className="muted small">
            3 gün ve üzeri bekleyen talepler, bakiye yeterliyse FIFO sırasıyla otomatik fonlanır.
          </p>
          <div className="pool-actions">
            <button type="button" className="primary" onClick={() => onDonateToPool(500)}>
              500 TL Bağışla
            </button>
            <button type="button" className="primary" onClick={() => onDonateToPool(1000)}>
              1000 TL Bağışla
            </button>
          </div>
        </article>
        <article className="metric-card">
          <p className="metric-kicker">Açık Talepler</p>
          <p className="metric-value">{sortedRequests.length}</p>
          <p className="muted small">Fonlanmayı bekleyen sepet</p>
        </article>
        <article className="metric-card">
          <p className="metric-kicker">Mahalle Esnafı</p>
          <p className="metric-value">{neighborhoodMerchants.length}</p>
          <p className="muted small">{selectedNeighborhood}</p>
        </article>
      </div>

      <div className="filter-card">
        <label>
          <span>Mahalle Seç</span>
          <SearchableSelect
            options={neighborhoodOptions}
            value={selectedNeighborhood}
            onChange={(value) => {
              setSelectedNeighborhood(value)
              setSelectedMerchant('')
            }}
            placeholder="Mahalle ara…"
          />
        </label>

        {!neighborhoodMerchants.length && (
          <p className="hint">
            Mahallenizde aktif esnaf bulunmamaktadır. Aktif mahalleler: {alternativeNeighborhoods.join(', ')}
          </p>
        )}

        {!!neighborhoodMerchants.length && (
          <label>
            <span>Esnaf Seç</span>
            <SearchableSelect
              options={uniqueSelectOptions(
                neighborhoodMerchants.map((merchant) => ({
                  value: canonicalName(merchant.name),
                  label: `${canonicalName(merchant.name)} (${getMerchantTypeLabel(merchant.merchantType)})`,
                })),
              )}
              value={selectedMerchant}
              onChange={handleMerchantChange}
              placeholder="Esnaf ara veya seçin…"
            />
          </label>
        )}
      </div>

      <div className="request-board">
        <div className="request-board-head">
          <h3>Talep Havuzu</h3>
          <span className="status-pill">{sortedRequests.length} açık talep</span>
        </div>
        {!sortedRequests.length && <p className="hint">Henüz fonlanmayı bekleyen yardım talebi yok.</p>}
        {sortedRequests.map((request) => (
          <article key={request.id} className="request-item">
            <div className="request-item-top">
              <p>
                <strong>{maskBeneficiaryName(request.beneficiaryName)}</strong>
                {request.sameNeighborhood && <span className="neighbor-badge">Mahalleliniz</span>}
              </p>
              <span className="status-pill status-pill--fund">{request.totalAmount} TL</span>
            </div>
            <p className="muted small">
              {request.productIds.length} ürün — Mahalle: {request.beneficiary?.neighborhood || '-'} — Bekleme:{' '}
              {request.waitingDays} gün
              {request.deliveryMethod === 'courier' && ` — Kurye (+${request.courierFee || COURIER_FEE} TL)`}
            </p>
            <p className="muted small">{formatProductList(request.productIds, products)}</p>
            {resolvedMerchantName && !request.canFulfill && (
              <p className="muted small">Seçili esnafın stoğunda bu sepetin tüm ürünleri yok.</p>
            )}
            <button
              type="button"
              className="primary"
              onClick={() => onFundRequest(request.id, donorName, resolvedMerchantName)}
              disabled={!resolvedMerchantName || !request.canFulfill}
            >
              Bu Talebi Karşıla (Öde)
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}

function BeneficiaryPanel({
  user,
  products,
  requests,
  cart,
  activeTab,
  onTabChange,
  onAddProduct,
  onRemoveProduct,
  onSubmitRequest,
}) {
  const myRequests = requests.filter((item) => item.beneficiaryName === user.name)
  const [selectedMerchant, setSelectedMerchant] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState('pickup')
  const { users } = useAppContext()
  const neighborhoodMerchants = uniqueMerchants(users)
    .filter((u) => u.neighborhood === user.neighborhood)
    .filter((u) => (u.inventory || []).some((i) => i.stock > 0))
  const selectedMerchantUser = findBySanitizedName(neighborhoodMerchants, selectedMerchant)
  const resolvedMerchantName = selectedMerchantUser?.name || canonicalName(selectedMerchant)

  const visibleProducts = useMemo(() => {
    if (!selectedMerchantUser) {
      return []
    }
    const stockedIds = new Set(
      (selectedMerchantUser.inventory || []).filter((i) => i.stock > 0).map((i) => i.productId),
    )
    return products.filter((product) => stockedIds.has(product.id))
  }, [products, selectedMerchantUser])

  const cartEntries = cart.map((productId) => {
    const product = products.find((item) => item.id === productId)
    return { productId, product }
  })

  const productTotal = cart.reduce((sum, productId) => {
    const product = products.find((item) => item.id === productId)
    return sum + (product?.price || 0)
  }, 0)
  const courierFee = deliveryMethod === 'courier' ? COURIER_FEE : 0
  const cartTotal = productTotal + courierFee

  const { ensureBekleyenTalep, getTalepByIsim } = useMahalleliTalepler()
  const kullaniciTalebi = getTalepByIsim(user.name)
  const isOnaylandi =
    kullaniciTalebi?.durum === 'onaylandi' || Boolean(user.isApproved || user.municipalityApproved)

  useEffect(() => {
    ensureBekleyenTalep(user.name, {
      tcKimlik: user.tcKimlik,
      phone: user.phone,
      address: user.address,
      email: user.email,
      neighborhood: user.neighborhood,
      isApproved: user.isApproved,
      municipalityApproved: user.municipalityApproved,
    })
  }, [
    user.name,
    user.tcKimlik,
    user.phone,
    user.address,
    user.email,
    user.neighborhood,
    ensureBekleyenTalep,
  ])

  return (
    <div className="stack">
      <div
        className={`approval-status-banner ${isOnaylandi ? 'approval-status-banner--approved' : 'approval-status-banner--pending'}`}
        role="status"
      >
        {isOnaylandi ? (
          <>
            <span className="approval-status-icon" aria-hidden="true">
              ✓
            </span>
            <span>
              Yardım talebiniz belediye ekipleri tarafından onaylanarak aktifleştirilmiştir ve bağış
              havuzuna iletilmiştir.
            </span>
          </>
        ) : (
          <>
            <span className="approval-status-icon" aria-hidden="true">
              ⚠
            </span>
            <span>
              Yardım talebiniz alınmıştır. Belediye sosyal hizmet ekiplerinin saha tespiti ve onay süreci
              devam etmektedir.
            </span>
          </>
        )}
      </div>

      <div className="segmented">
        <button
          type="button"
          className={activeTab === 'market' ? 'selected' : ''}
          onClick={() => onTabChange('market')}
        >
          Ürünler
        </button>
        <button
          type="button"
          className={activeTab === 'orders' ? 'selected' : ''}
          onClick={() => onTabChange('orders')}
        >
          Taleplerim
        </button>
      </div>

      {activeTab === 'market' && (
        <>
          <label>
            <span>Esnaf Seç</span>
            <SearchableSelect
              options={uniqueSelectOptions(
                neighborhoodMerchants.map((m) => ({
                  value: canonicalName(m.name),
                  label: `${canonicalName(m.name)} (${getMerchantTypeLabel(m.merchantType)})`,
                })),
              )}
              value={selectedMerchant}
              onChange={(value) => setSelectedMerchant(canonicalName(value))}
              placeholder="Esnaf ara veya seçin…"
            />
          </label>
          {!isOnaylandi && (
            <p className="hint">Belediye onayı tamamlanmadan ürün ekleyemezsiniz.</p>
          )}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={{
                  ...product,
                  categoryLabel: CATEGORY_LABELS[product.category],
                }}
                stock={
                  selectedMerchantUser?.inventory?.find((i) => i.productId === product.id)?.stock ??
                  (selectedMerchant ? 0 : null)
                }
                inCart={cart.includes(product.id)}
                onAdd={() => onAddProduct(user.name, product.id)}
                disabled={
                  !isOnaylandi ||
                  !selectedMerchantUser ||
                  (selectedMerchantUser.inventory || []).find((i) => i.productId === product.id)?.stock <= 0
                }
              />
            ))}
          </div>
          {!selectedMerchant && <p className="muted small">Ürünleri görmek için önce esnaf seçin.</p>}

          <fieldset className="soft-box delivery-method-box">
            <legend>Teslimat Yöntemi</legend>
            <label className="delivery-option">
              <input
                type="radio"
                name="deliveryMethod"
                value="pickup"
                checked={deliveryMethod === 'pickup'}
                onChange={() => setDeliveryMethod('pickup')}
              />
              <span>Gel-Al (Ücretsiz)</span>
            </label>
            <label className="delivery-option">
              <input
                type="radio"
                name="deliveryMethod"
                value="courier"
                checked={deliveryMethod === 'courier'}
                onChange={() => setDeliveryMethod('courier')}
              />
              <span>Kurye ile Gönder (+{COURIER_FEE} TL)</span>
            </label>
          </fieldset>

          <div className="cart-bar">
            <p>
              Sepet: {cart.length} ürün — Ürün: <strong>{productTotal} TL</strong>
              {courierFee > 0 && (
                <>
                  {' '}
                  + Kurye: <strong>{courierFee} TL</strong>
                </>
              )}{' '}
              — Toplam: <strong>{cartTotal} TL</strong>
            </p>
            <button
              type="button"
              className="primary"
              onClick={() => onSubmitRequest(user.name, deliveryMethod, resolvedMerchantName)}
              disabled={!cart.length || !resolvedMerchantName || !isOnaylandi}
            >
              Yardım Talebi Oluştur
            </button>
          </div>
          <div className="stack soft-box">
            <p className="muted small">Sepet Detayı (ürün başına max. 1 adet)</p>
            {!cartEntries.length && <p className="muted small">Sepetiniz boş.</p>}
            {cartEntries.map((entry) => (
              <div key={entry.productId} className="cart-item-row">
                <p className="small">{entry.product?.name}</p>
                <button
                  type="button"
                  className="secondary compact"
                  onClick={() => onRemoveProduct(user.name, entry.productId)}
                >
                  Sil
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'orders' && (
        <div className="stack">
          {!myRequests.length && <p className="muted">Henüz talep oluşturmadınız.</p>}
          {myRequests.map((request) => (
            <article key={request.id} className="request-item">
              <p>
                Talep: <strong>{request.totalAmount} TL</strong>
              </p>
              <p className="muted small">Ürün tutarı: {request.productTotal ?? request.totalAmount} TL</p>
              {request.courierFee > 0 && (
                <p className="muted small">Kurye ücreti: {request.courierFee} TL</p>
              )}
              <p className="muted small">
                Teslimat: {request.deliveryMethod === 'courier' ? 'Kurye' : 'Gel-Al'} — Durum:{' '}
                {translateStatus(request.status)}
              </p>
              <p className="muted small">{formatProductList(request.productIds, products)}</p>
              {request.status === 'funded' && request.deliveryMethod === 'pickup' && (
                <>
                  <p className="muted">Bu QR kod ile esnaftan teslim alabilirsiniz.</p>
                  <QRSimulator code={request.qrCode} />
                </>
              )}
              {request.status === 'funded' && request.deliveryMethod === 'courier' && (
                <p className="hint">Siparişiniz hazırlanıyor. Esnaf kuryeye teslim edecektir.</p>
              )}
              {request.status === 'courier_dispatched' && (
                <p className="support-success-hint">Siparişiniz kuryeye verildi.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function MerchantPanel({
  products,
  requests,
  users,
  merchantName,
  merchantType,
  merchantInventory,
  onUpdateInventory,
  onMarkDelivered,
  onDeliverByTc,
  onHandoffToCourier,
  onCreateProxyRequest,
  scanCode,
  setScanCode,
}) {
  const [activeTab, setActiveTab] = useState('stok')
  const [draftInventory, setDraftInventory] = useState(merchantInventory)
  const [tcKimlik, setTcKimlik] = useState('')
  const [citizenQuery, setCitizenQuery] = useState(null)
  const [proxyProductId, setProxyProductId] = useState('')

  const merchantProducts = useMemo(
    () => products.filter((product) => canMerchantSellProduct(merchantType, product.category)),
    [products, merchantType],
  )

  const matchesBranch = (item) => !item.merchantType || item.merchantType === merchantType

  const pickupFunded = requests.filter(
    (item) =>
      item.status === 'funded' &&
      item.deliveryMethod === 'pickup' &&
      (!item.merchantName || namesMatch(item.merchantName, merchantName)) &&
      matchesBranch(item),
  )
  const courierFunded = requests.filter(
    (item) =>
      item.status === 'funded' &&
      item.deliveryMethod === 'courier' &&
      namesMatch(item.merchantName, merchantName) &&
      matchesBranch(item),
  )
  const pendingBranch = requests.filter(
    (item) =>
      item.status === 'requested' &&
      matchesBranch(item) &&
      (!item.merchantName || namesMatch(item.merchantName, merchantName)),
  )

  useEffect(() => {
    setDraftInventory(merchantInventory)
  }, [merchantInventory])

  const handleCitizenQuery = () => {
    const normalizedTc = tcKimlik.replace(/\D/g, '')
    if (normalizedTc.length !== 11) {
      setCitizenQuery({ type: 'invalid-tc' })
      return
    }

    const beneficiary = users.find(
      (item) => item.role === 'beneficiary' && item.tcKimlik === normalizedTc,
    )
    if (!beneficiary) {
      setCitizenQuery({ type: 'not-found', tc: normalizedTc })
      return
    }

    const activeRequests = requests.filter(
      (item) =>
        item.beneficiaryName === beneficiary.name && ['requested', 'funded'].includes(item.status),
    )
    const fundedReady = activeRequests.find(
      (item) =>
        item.status === 'funded' &&
        item.deliveryMethod === 'pickup' &&
        (!item.merchantName || namesMatch(item.merchantName, merchantName)),
    )
    if (fundedReady) {
      setCitizenQuery({ type: 'delivery', tc: normalizedTc, request: fundedReady, beneficiary })
      return
    }
    if (activeRequests.some((item) => item.status === 'requested')) {
      setCitizenQuery({ type: 'pending-donation', beneficiary })
      return
    }
    if (activeRequests.some((item) => item.status === 'funded')) {
      setCitizenQuery({ type: 'funded-elsewhere', beneficiary })
      return
    }

    setProxyProductId(merchantProducts[0]?.id || '')
    setCitizenQuery({ type: 'no-active', tc: normalizedTc, beneficiary })
  }

  const handleProxyCreate = () => {
    if (!citizenQuery?.tc || !proxyProductId) {
      return
    }
    onCreateProxyRequest(citizenQuery.tc, proxyProductId, merchantName)
    setCitizenQuery({ type: 'pending-donation', beneficiary: citizenQuery.beneficiary })
  }

  const handleTcDeliver = () => {
    if (!citizenQuery?.tc) {
      return
    }
    onDeliverByTc(citizenQuery.tc, merchantName)
    setCitizenQuery(null)
    setTcKimlik('')
  }

  return (
    <div className="stack">
      <p className="muted small">
        İşletme tipi: <strong>{getMerchantTypeLabel(merchantType)}</strong>
      </p>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('stok')}
          className={`rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150 ${
            activeTab === 'stok'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'border border-slate-200/80 bg-white text-slate-600 hover:-translate-y-0.5 hover:shadow-md'
          }`}
        >
          📦 Stok Yönetimi
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('teslimat')}
          className={`rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150 ${
            activeTab === 'teslimat'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'border border-slate-200/80 bg-white text-slate-600 hover:-translate-y-0.5 hover:shadow-md'
          }`}
        >
          🛵 Teslimat İşlemleri
        </button>
      </div>

      {activeTab === 'stok' && (
        <fieldset className="soft-box">
          <legend>Stoktaki Ürünler</legend>
          <div className="flex flex-col gap-3">
            {merchantProducts.map((product) => {
              const row = draftInventory.find((i) => i.productId === product.id)
              const isActive = !!row
              return (
                <div
                  key={product.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-nowrap"
                >
                  <ProductImage
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    placeholderClassName="h-16 w-16 shrink-0 rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-900">{product.name}</p>
                    <p className="text-sm font-semibold text-emerald-600">
                      {product.price} TL
                      <span className="ml-2 font-normal text-slate-500">
                        · {CATEGORY_LABELS[product.category]}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className={`switch ${isActive ? 'on' : ''}`}
                      onClick={() =>
                        setDraftInventory((current) =>
                          isActive
                            ? current.filter((i) => i.productId !== product.id)
                            : [...current, { productId: product.id, stock: 10 }],
                        )
                      }
                    >
                      <span className="switch-knob" />
                      <span className="switch-label">{isActive ? 'Aktif' : 'Pasif'}</span>
                    </button>
                    <input
                      type="number"
                      min={0}
                      className="stock-input !w-20 shrink-0 rounded-xl border border-slate-300 bg-white px-2 py-2 text-center text-sm font-semibold text-slate-900 shadow-sm disabled:bg-slate-50"
                      value={row?.stock ?? ''}
                      disabled={!isActive}
                      onChange={(event) => {
                        const value = Number(event.target.value)
                        setDraftInventory((current) =>
                          current.map((i) =>
                            i.productId === product.id ? { ...i, stock: Number.isFinite(value) ? value : 0 } : i,
                          ),
                        )
                      }}
                      placeholder="Stok"
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <button type="button" className="secondary top-gap" onClick={() => onUpdateInventory(merchantName, draftInventory)}>
            Stokları Kaydet
          </button>
        </fieldset>
      )}

      {activeTab === 'teslimat' && (
        <>
          {pendingBranch.length > 0 && (
            <div className="soft-box">
              <p className="muted">Branşınıza ait bekleyen sepetler</p>
              {pendingBranch.map((request) => (
                <p key={request.id} className="muted small">
                  {request.beneficiaryName} — {request.totalAmount} TL
                  {request.merchantName && !namesMatch(request.merchantName, merchantName)
                    ? ` · ${request.merchantName}`
                    : ''}
                </p>
              ))}
            </div>
          )}
          <div className="soft-box">
            <p className="muted">Gel-Al Siparişleri — QR Okuyucu</p>
            <label>
              <span>QR Kod Değeri</span>
              <input
                type="text"
                value={scanCode}
                onChange={(event) => setScanCode(event.target.value)}
                placeholder="QR kodu buraya girin"
              />
            </label>
            <button
              type="button"
              className="primary"
              onClick={() => onMarkDelivered(scanCode, merchantName)}
              disabled={!pickupFunded.length}
            >
              QR Okut ve Teslim Et
            </button>
            {pickupFunded[0] && (
              <button type="button" className="secondary" onClick={() => setScanCode(pickupFunded[0].qrCode)}>
                Demo: QR Kodunu Otomatik Doldur
              </button>
            )}
            {!pickupFunded.length && <p className="muted small">Bekleyen gel-al teslimatı yok.</p>}
          </div>

          <div className="soft-box">
            <p className="muted">Kurye Siparişleri</p>
            {!courierFunded.length && <p className="muted small">Kuryeye verilecek sipariş yok.</p>}
            {courierFunded.map((request) => (
              <div key={request.id} className="approval-row">
                <p className="approval-row-text">
                  {request.beneficiaryName} — {request.totalAmount} TL
                </p>
                <button
                  type="button"
                  className="success approval-action-btn"
                  onClick={() => onHandoffToCourier(request.id, merchantName)}
                >
                  Kuryeye Verildi
                </button>
              </div>
            ))}
          </div>

          <fieldset className="soft-box elder-support-module">
            <legend>Yaşlı/Teknolojisiz Vatandaş Destek Modülü</legend>
            <p className="muted small">
              Demo: <code className="demo-tc">11111111111</code> (teslimat) ·{' '}
              <code className="demo-tc">22222222222</code> (vekaleten talep)
            </p>
            <label>
              <span>Manuel T.C. Sorgulama</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={11}
                value={tcKimlik}
                onChange={(event) => {
                  setTcKimlik(event.target.value.replace(/\D/g, '').slice(0, 11))
                  setCitizenQuery(null)
                }}
                placeholder="11 haneli T.C. kimlik numarası"
              />
            </label>
            <button type="button" className="secondary" onClick={handleCitizenQuery} disabled={tcKimlik.length !== 11}>
              Sorgula
            </button>

            {citizenQuery?.type === 'invalid-tc' && (
              <p className="support-alert">Geçerli bir 11 haneli T.C. kimlik numarası girin.</p>
            )}
            {citizenQuery?.type === 'not-found' && (
              <p className="support-alert">Bu T.C. ile kayıtlı ihtiyaç sahibi bulunamadı.</p>
            )}
            {citizenQuery?.type === 'delivery' && (
              <div className="support-result">
                <p className="support-success-hint">
                  {citizenQuery.beneficiary.name} - Fonlanmış Paket Hazır
                </p>
                <button
                  type="button"
                  className="success deliver-ready-btn"
                  onClick={handleTcDeliver}
                >
                  Teslim Et
                </button>
              </div>
            )}
            {citizenQuery?.type === 'pending-donation' && (
              <p className="support-alert">
                {citizenQuery.beneficiary.name} - Bağış bekleyen aktif talep zaten mevcut.
              </p>
            )}
            {citizenQuery?.type === 'funded-elsewhere' && (
              <p className="support-alert">
                {citizenQuery.beneficiary.name} - Fonlanmış sipariş başka bir işletmede teslimata hazır.
              </p>
            )}
            {citizenQuery?.type === 'no-active' && (
              <div className="support-result">
                <p className="support-warning">
                  {citizenQuery.beneficiary.name} - Aktif Talep Bulunmamaktadır
                </p>
                <label>
                  <span>Ürün Seçin</span>
                  <select value={proxyProductId} onChange={(event) => setProxyProductId(event.target.value)}>
                    {merchantProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} — {product.price} TL
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="primary"
                  onClick={handleProxyCreate}
                  disabled={!proxyProductId}
                >
                  Teyze Adına Talep Oluştur
                </button>
              </div>
            )}
          </fieldset>
        </>
      )}
    </div>
  )
}

function MunicipalityPanel({
  user,
  users = [],
  totalAccounts,
  requestedCount,
  fundedCount,
  deliveredCount,
  poolBalance,
  onRunPoolAutoFunding,
}) {
  const { bekleyenTalepler, onaylananTalepler, onaylaTalep } = useMahalleliTalepler()
  const [expandedId, setExpandedId] = useState(null)
  const [panelCity, setPanelCity] = useState(user?.city || DEFAULT_CITY)
  const [panelDistrict, setPanelDistrict] = useState(user?.district || DEFAULT_DISTRICT)
  const canApprove = canApproveBeneficiaries(user?.unit)
  const districtOptions = useMemo(() => getDistrictsForCity(panelCity), [panelCity])

  const enrichedBekleyenTalepler = useMemo(() => {
    return bekleyenTalepler.map((talep) => {
      const beneficiary = users.find(
        (item) =>
          item.role === 'beneficiary' &&
          String(item.name || '').trim().toLocaleLowerCase('tr-TR') ===
            String(talep.isim || '').trim().toLocaleLowerCase('tr-TR'),
      )
      return {
        ...talep,
        isim: beneficiary?.name || talep.isim,
        tcKimlik: beneficiary?.tcKimlik || talep.tcKimlik || '',
        email: beneficiary?.email || talep.email || '',
        phone: beneficiary?.phone || talep.phone || '',
        address: beneficiary?.address || talep.address || '',
        neighborhood: beneficiary?.neighborhood || talep.neighborhood || '',
      }
    })
  }, [bekleyenTalepler, users])

  useEffect(() => {
    if (!districtOptions.includes(panelDistrict)) {
      setPanelDistrict(districtOptions[0] || '')
    }
  }, [districtOptions, panelDistrict])

  const toggleExpand = (id) => {
    setExpandedId((current) => (current === id ? null : id))
  }

  const phoneHref = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '')
    return digits ? `tel:+90${digits.replace(/^0/, '')}` : null
  }

  return (
    <div className="stack municipality-panel">
      <div className="soft-box municipality-scope">
        <p className="pool-panel-title">Yetki ve Bölge</p>
        <p className="muted small">
          Birim: <strong>{getMunicipalityUnitLabel(user?.unit)}</strong>
          {canApprove
            ? ' — İhtiyaç sahibi onay yetkisi aktif'
            : ' — İhtiyaç sahibi onay yetkisi yok (yalnızca görüntüleme)'}
        </p>
        <div className="municipality-location-grid">
          <label>
            <span>İl</span>
            <SearchableSelect
              options={CITIES}
              value={panelCity}
              onChange={setPanelCity}
              placeholder="İl ara…"
            />
          </label>
          <label>
            <span>İlçe</span>
            <SearchableSelect
              options={districtOptions}
              value={panelDistrict}
              onChange={setPanelDistrict}
              placeholder="İlçe ara…"
            />
          </label>
        </div>
        <p className="muted small">
          Görev alanı: {panelCity} / {panelDistrict} (mahalle seçimi belediye rolünde kullanılmaz)
        </p>
      </div>

      <div className="stat-grid">
        <article>
          <h3>{totalAccounts}</h3>
          <p>Aktif Oturum</p>
        </article>
        <article>
          <h3>{requestedCount}</h3>
          <p>Talep Havuzu</p>
        </article>
        <article>
          <h3>{fundedCount}</h3>
          <p>Fonlandı</p>
        </article>
        <article>
          <h3>{deliveredCount}</h3>
          <p>Teslim Edildi</p>
        </article>
        <article>
          <h3>{poolBalance} TL</h3>
          <p>Genel Havuz</p>
        </article>
      </div>

      <div className="pool-panel soft-box">
        <p className="pool-panel-title">Adaletli Otomatik Fonlama</p>
        <p className="muted small">
          3 gün ve üzeri bekleyen talepler, havuz bakiyesi yeterliyse en eski talepten başlanarak otomatik
          fonlanır. Bu kontrol panel her açıldığında otomatik çalışır; anlık kontrol için de kullanabilirsiniz.
        </p>
        <button type="button" className="secondary" onClick={onRunPoolAutoFunding}>
          Havuz Fonlamasını Şimdi Kontrol Et
        </button>
      </div>

      <div className="approval-queue soft-box">
        <p className="approval-queue-title">Saha Tespiti Onay Kuyruğu</p>
        {!canApprove && (
          <p className="support-warning">
            Bilişim Teknolojileri Müdürlüğü onay işlemi yapamaz. Onay için Başkan Yardımcılığı veya Sosyal
            Destek Hizmetleri Müdürlüğü yetkilisi gerekir.
          </p>
        )}
        {!enrichedBekleyenTalepler.length && (
          <p className="muted small">Onay bekleyen başvuru bulunmuyor.</p>
        )}
        {enrichedBekleyenTalepler.map((talep) => {
          const isOpen = expandedId === talep.id
          const callLink = phoneHref(talep.phone)
          return (
            <article key={talep.id} className={`approval-accordion ${isOpen ? 'is-open' : ''}`}>
              <button
                type="button"
                className="approval-accordion-head"
                onClick={() => toggleExpand(talep.id)}
                aria-expanded={isOpen}
              >
                <div className="approval-accordion-summary">
                  <strong>{talep.isim}</strong>
                  <span className="approval-status-chip">Bekliyor</span>
                </div>
                <span className="approval-accordion-chevron" aria-hidden="true">
                  {isOpen ? '▾' : '▸'}
                </span>
              </button>

              {isOpen && (
                <div className="approval-accordion-body">
                  <p className="muted small">{formatTalepKuyrukMetni(talep)}</p>
                  <dl className="approval-detail-grid">
                    <div>
                      <dt>Ad Soyad</dt>
                      <dd>{talep.isim || '—'}</dd>
                    </div>
                    <div>
                      <dt>T.C. Kimlik No</dt>
                      <dd>{talep.tcKimlik || '—'}</dd>
                    </div>
                    <div>
                      <dt>E-posta</dt>
                      <dd>{talep.email || '—'}</dd>
                    </div>
                    <div>
                      <dt>Telefon</dt>
                      <dd className="phone-row">
                        <span>{talep.phone || '—'}</span>
                        {callLink && (
                          <a className="call-btn" href={callLink}>
                            Ara
                          </a>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Mahalle</dt>
                      <dd>{talep.neighborhood || '—'}</dd>
                    </div>
                    <div>
                      <dt>Durum</dt>
                      <dd>Saha tespiti bekliyor</dd>
                    </div>
                    <div className="approval-detail-full">
                      <dt>Adres</dt>
                      <dd>{talep.address || '—'}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className="success approval-action-btn"
                    onClick={() => onaylaTalep(talep.id)}
                    disabled={!canApprove}
                    title={
                      canApprove
                        ? 'Başvuruyu doğrula ve havuza aktar'
                        : 'Bu birimin onay yetkisi bulunmuyor'
                    }
                  >
                    Doğrula ve Onayla
                  </button>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {!!onaylananTalepler.length && (
        <div className="approval-approved-list stack">
          {onaylananTalepler.map((talep) => (
            <p key={talep.id} className="approval-row-approved">
              {formatTalepOnayMetni(talep)}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function translateStatus(status) {
  const map = {
    requested: 'Talep Oluşturuldu',
    funded: 'Bağışçı / Havuz Tarafından Fonlandı',
    courier_dispatched: 'Kuryeye Verildi',
    delivered: 'Teslim Edildi',
  }
  return map[status] || status
}

function formatProductList(productIds = [], products) {
  return productIds
    .map((id) => products.find((item) => item.id === id)?.name)
    .filter(Boolean)
    .join(', ')
}

function maskBeneficiaryName(name) {
  if (!name) {
    return '—'
  }
  return name
    .trim()
    .split(/\s+/)
    .map((word) => {
      const first = word.charAt(0)
      if (!first) {
        return ''
      }
      return first + '*'.repeat(Math.max(word.length - 1, 2))
    })
    .join(' ')
}

export default Dashboard
