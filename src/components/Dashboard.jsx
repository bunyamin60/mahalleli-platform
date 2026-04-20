import QRSimulator from './QRSimulator'
import { ROLES } from '../data/roles'
import { useAppContext } from '../context/AppContext'
import { useState } from 'react'
import FoodPackageCard from './FoodPackageCard'

function Dashboard({ role, user }) {
  const {
    aidPackages,
    requests,
    carts,
    users,
    addPackageToCart,
    removePackageFromCart,
    deletePackageFromCart,
    submitAidRequest,
    fundRequest,
    deliverByQr,
    updateMerchantInventory,
    sessions,
  } = useAppContext()
  const [scanCode, setScanCode] = useState('')
  const [activeBeneficiaryTab, setActiveBeneficiaryTab] = useState('market')

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
        <h2>Merhaba, {user.name}</h2>
      </div>

      {role === 'donor' && (
        <DonorPanel requests={requests} donorName={sessions.donor?.name} onFundRequest={fundRequest} users={users} />
      )}
      {role === 'beneficiary' && (
        <BeneficiaryPanel
          user={user}
          aidPackages={aidPackages}
          requests={requests}
          cart={carts[user.name] || []}
          activeTab={activeBeneficiaryTab}
          onTabChange={setActiveBeneficiaryTab}
          onAddPackage={addPackageToCart}
          onRemovePackage={removePackageFromCart}
          onDeletePackage={deletePackageFromCart}
          onSubmitRequest={submitAidRequest}
        />
      )}
      {role === 'merchant' && (
        <MerchantPanel
          aidPackages={aidPackages}
          requests={requests}
          merchantName={user.name}
          merchantInventory={user.inventory || []}
          onUpdateInventory={updateMerchantInventory}
          onMarkDelivered={deliverByQr}
          scanCode={scanCode}
          setScanCode={setScanCode}
        />
      )}
      {role === 'municipality' && (
        <MunicipalityPanel
          totalAccounts={Object.values(sessions).filter(Boolean).length}
          requestedCount={requests.filter((item) => item.status === 'requested').length}
          fundedCount={requests.filter((item) => item.status === 'funded').length}
          deliveredCount={deliveredCount}
        />
      )}
    </section>
  )
}

function DonorPanel({ requests, donorName, onFundRequest, users }) {
  const donor = users.find((item) => item.role === 'donor' && item.name === donorName)
  const donorNeighborhood = donor?.neighborhood
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(donorNeighborhood || 'Sakarya')
  const [selectedMerchant, setSelectedMerchant] = useState('')

  const merchants = users.filter((item) => item.role === 'merchant' && (item.inventory || []).some((i) => i.stock > 0))
  const neighborhoodMerchants = merchants.filter((item) => item.neighborhood === selectedNeighborhood)
  const alternativeNeighborhoods = [...new Set(merchants.map((item) => item.neighborhood))]
  const selectedMerchantUser = neighborhoodMerchants.find((item) => item.name === selectedMerchant)
  const openRequests = requests.filter((item) => item.status === 'requested')
  const sortedRequests = openRequests
    .map((request) => {
      const beneficiary = users.find((item) => item.role === 'beneficiary' && item.name === request.beneficiaryName)
      const sameNeighborhood = beneficiary?.neighborhood === donorNeighborhood
      return { ...request, beneficiary, sameNeighborhood }
    })
    .sort((a, b) => Number(b.sameNeighborhood) - Number(a.sameNeighborhood))
  const enrichedRequests = selectedMerchantUser
    ? sortedRequests.filter((request) =>
        request.packageIds.every((packageId) => (selectedMerchantUser.inventory || []).some((i) => i.packageId === packageId && i.stock > 0)),
      )
    : sortedRequests

  return (
    <div className="stack">
      <label>
        <span>Mahalle Sec</span>
        <select value={selectedNeighborhood} onChange={(event) => setSelectedNeighborhood(event.target.value)}>
          {[...new Set(users.map((item) => item.neighborhood).filter(Boolean))].map((neighborhood) => (
            <option key={neighborhood} value={neighborhood}>
              {neighborhood}
            </option>
          ))}
        </select>
      </label>

      {!neighborhoodMerchants.length && (
        <p className="hint">
          Mahallenizde aktif market bulunmamaktadir, ancak su mahallelerdeki marketler aktiftir:{' '}
          {alternativeNeighborhoods.join(', ')}
        </p>
      )}

      {!!neighborhoodMerchants.length && (
        <label>
          <span>Market / Esnaf Sec</span>
          <select value={selectedMerchant} onChange={(event) => setSelectedMerchant(event.target.value)}>
            <option value="">Seciniz</option>
            {neighborhoodMerchants.map((merchant) => (
              <option key={merchant.name} value={merchant.name}>
                {merchant.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {selectedMerchantUser && (
        <div className="soft-box">
          <p className="muted small">Secili marketin stoktaki paketleri</p>
          <p className="small">
            {(selectedMerchantUser.inventory || [])
              .filter((i) => i.stock > 0)
              .map((i) => i.packageId)
              .map((id) => aidPackageNameById(id))
              .filter(Boolean)
              .join(', ')}
          </p>
        </div>
      )}

      <p className="muted">Talep havuzu: {enrichedRequests.length} açık talep</p>
      {!enrichedRequests.length && <p className="hint">Henüz fonlanmayı bekleyen yardım talebi yok.</p>}
      {enrichedRequests.map((request) => (
        <article key={request.id} className="request-item">
          <p>
            <strong>{request.beneficiaryName}</strong> - {request.totalAmount} TL
            {request.sameNeighborhood && <span className="neighbor-badge">Mahalleliniz</span>}
          </p>
          <p className="muted small">
            Paket adedi: {request.packageIds.length} - Mahalle: {request.beneficiary?.neighborhood || '-'}
          </p>
          <button
            type="button"
            className="primary bg-gradient from-cyan-500 to-blue-500"
            onClick={() => onFundRequest(request.id, donorName, selectedMerchant)}
            disabled={!selectedMerchant}
          >
            Bu Talebi Karşıla (Öde)
          </button>
        </article>
      ))}
    </div>
  )
}

function BeneficiaryPanel({
  user,
  aidPackages,
  requests,
  cart,
  activeTab,
  onTabChange,
  onAddPackage,
  onRemovePackage,
  onDeletePackage,
  onSubmitRequest,
}) {
  const myRequests = requests.filter((item) => item.beneficiaryName === user.name)
  const [selectedMerchant, setSelectedMerchant] = useState('')
  const { users } = useAppContext()
  const neighborhoodMerchants = users
    .filter((u) => u.role === 'merchant')
    .filter((u) => u.neighborhood === user.neighborhood)
    .filter((u) => (u.inventory || []).some((i) => i.stock > 0))
  const selectedMerchantUser = neighborhoodMerchants.find((m) => m.name === selectedMerchant)
  const cartSummary = cart.reduce((acc, packageId) => {
    acc[packageId] = (acc[packageId] || 0) + 1
    return acc
  }, {})
  const cartEntries = Object.entries(cartSummary).map(([packageId, quantity]) => {
    const pkg = aidPackages.find((item) => item.id === packageId)
    return { packageId, quantity, pkg }
  })

  const cartTotal = cart.reduce((sum, packageId) => {
    const pkg = aidPackages.find((item) => item.id === packageId)
    return sum + (pkg?.price || 0)
  }, 0)

  return (
    <div className="stack">
      <div className="segmented">
        <button
          type="button"
          className={activeTab === 'market' ? 'selected' : ''}
          onClick={() => onTabChange('market')}
        >
          Market/Paketler
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
            <span>Esnaf / Market Seç</span>
            <select value={selectedMerchant} onChange={(e) => setSelectedMerchant(e.target.value)}>
              <option value="">Seçiniz</option>
              {neighborhoodMerchants.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <div className="package-grid">
            {aidPackages.map((pkg) => (
              <FoodPackageCard
                key={pkg.id}
                pkg={pkg}
                stock={
                  selectedMerchantUser?.inventory?.find((i) => i.packageId === pkg.id)?.stock ??
                  (selectedMerchant ? 0 : null)
                }
                onAdd={() => onAddPackage(user.name, pkg.id)}
                disabled={!selectedMerchantUser || (selectedMerchantUser.inventory || []).find((i) => i.packageId === pkg.id)?.stock <= 0}
              />
            ))}
          </div>
          <div className="cart-bar">
            <p>
              Sepet: {cart.length} paket - <strong>{cartTotal} TL</strong>
            </p>
            <button
              type="button"
              className="primary bg-gradient from-violet-500 to-fuchsia-500"
              onClick={() => onSubmitRequest(user.name)}
              disabled={!cart.length}
            >
              Yardım Talebi Oluştur
            </button>
          </div>
          <div className="stack soft-box">
            <p className="muted small">Sepet Detayı</p>
            {!cartEntries.length && <p className="muted small">Sepetiniz boş.</p>}
            {cartEntries.map((entry) => (
              <div key={entry.packageId} className="cart-item-row">
                <p className="small">
                  {entry.pkg?.name} x {entry.quantity}
                </p>
                <div className="cart-actions">
                  <button
                    type="button"
                    className="secondary compact"
                    onClick={() => onRemovePackage(user.name, entry.packageId)}
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    className="secondary compact"
                    onClick={() => onDeletePackage(user.name, entry.packageId)}
                  >
                    Sil
                  </button>
                </div>
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
              <p className="muted small">Toplam urun degeri: {request.totalValue} TL</p>
              <p className="muted small">Durum: {translateStatus(request.status)}</p>
              {request.status === 'funded' && (
                <>
                  <p className="muted">Bu QR kod ile esnaftan teslim alabilirsiniz.</p>
                  <QRSimulator code={request.qrCode} />
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function MerchantPanel({
  aidPackages,
  requests,
  merchantName,
  merchantInventory,
  onUpdateInventory,
  onMarkDelivered,
  scanCode,
  setScanCode,
}) {
  const [draftInventory, setDraftInventory] = useState(merchantInventory)
  const fundedRequests = requests.filter((item) => item.status === 'funded' && item.merchantName === merchantName)

  return (
    <div className="stack">
      <fieldset className="soft-box">
        <legend>Stokta Olan Paketler</legend>
        <div className="stock-list">
          {aidPackages.map((pkg) => {
            const row = draftInventory.find((i) => i.packageId === pkg.id)
            const isActive = !!row
            return (
              <div key={pkg.id} className="stock-row">
                <div className="stock-left">
                  <p className="stock-title">{pkg.name}</p>
                  <p className="muted small">Aktif edince stok miktarı girin</p>
                </div>
                <div className="stock-right">
                  <button
                    type="button"
                    className={`switch ${isActive ? 'on' : ''}`}
                    onClick={() =>
                      setDraftInventory((current) =>
                        isActive
                          ? current.filter((i) => i.packageId !== pkg.id)
                          : [...current, { packageId: pkg.id, stock: 10 }],
                      )
                    }
                  >
                    <span className="switch-knob" />
                    <span className="switch-label">{isActive ? 'Aktif' : 'Pasif'}</span>
                  </button>
                  <input
                    type="number"
                    min={0}
                    className="stock-input"
                    value={row?.stock ?? ''}
                    disabled={!isActive}
                    onChange={(event) => {
                      const value = Number(event.target.value)
                      setDraftInventory((current) =>
                        current.map((i) =>
                          i.packageId === pkg.id ? { ...i, stock: Number.isFinite(value) ? value : 0 } : i,
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
      <p className="muted">QR Okuyucu Simulasyonu</p>
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
        className="primary bg-gradient from-amber-500 to-orange-500"
        onClick={() => onMarkDelivered(scanCode, merchantName)}
        disabled={!fundedRequests.length}
      >
        QR Okut ve Teslim Et
      </button>
      {fundedRequests[0] && (
        <button type="button" className="secondary" onClick={() => setScanCode(fundedRequests[0].qrCode)}>
          Demo: QR Kodunu Otomatik Doldur
        </button>
      )}
      <div className="stack soft-box">
        <p className="muted small">Fonlanmış bekleyen siparişler</p>
        {!fundedRequests.length && <p className="muted">Bekleyen teslimat yok.</p>}
        {fundedRequests.map((request) => (
          <p key={request.id} className="small">
            {request.beneficiaryName} - {request.totalAmount} TL
          </p>
        ))}
      </div>
    </div>
  )
}

function MunicipalityPanel({ totalAccounts, requestedCount, fundedCount, deliveredCount }) {
  return (
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
    </div>
  )
}

function translateStatus(status) {
  const map = {
    requested: 'Talep Oluşturuldu',
    funded: 'Bağışçı Tarafından Fonlandı',
    delivered: 'Teslim Edildi',
  }
  return map[status] || status
}

function aidPackageNameById(id) {
  const map = {
    'food-basic': 'Temel Gida Paketi',
    'baby-care': 'Bebek Bakim Paketi',
    'stationery-set': 'Kirtasiye Seti',
    'hygiene-pack': 'Hijyen Paketi',
  }
  return map[id]
}

export default Dashboard
