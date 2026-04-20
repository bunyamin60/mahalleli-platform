import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

function FoodPackageCard({ pkg, stock, disabled = false, onAdd }) {
  const [isOpen, setIsOpen] = useState(false)
  const totalValue = useMemo(
    () => pkg.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [pkg.items],
  )

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  return (
    <>
      <article className="package-card">
        <img src={pkg.imageUrl} alt={pkg.name} />
        <div className="package-content">
          <h3>{pkg.name}</h3>
          <p className="muted">{pkg.description}</p>
          {typeof stock === 'number' && (
            <div className="stock-badges">
              {stock > 0 ? (
                <span className="badge-stock">Kalan Stok: {stock}</span>
              ) : (
                <span className="badge-soldout">Tükendi</span>
              )}
            </div>
          )}
          <div className="price-row">
            <span className="badge-price">{pkg.price} TL</span>
            <span className="muted small">Toplam Ürün Değeri: {totalValue} TL</span>
          </div>
          <div className="package-actions">
            <button type="button" className="secondary" onClick={() => setIsOpen(true)}>
              İçindekileri Göster
            </button>
            <button
              type="button"
              className="primary bg-gradient from-violet-500 to-fuchsia-500"
              onClick={onAdd}
              disabled={disabled}
            >
              Sepete Ekle
            </button>
          </div>
        </div>
      </article>

      {isOpen &&
        createPortal(
          <div className="modal-overlay" role="presentation" onClick={() => setIsOpen(false)}>
            <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <h3>{pkg.name} - İçindekiler</h3>
                <button type="button" className="secondary" onClick={() => setIsOpen(false)}>
                  Kapat
                </button>
              </div>
              <div className="item-table">
                <div className="item-row item-head">
                  <span>Urun</span>
                  <span>Marka</span>
                  <span>Adet</span>
                  <span>Birim Fiyat</span>
                </div>
                {pkg.items.map((item) => (
                  <div key={`${item.brand}-${item.name}`} className="item-row">
                    <span>{item.name}</span>
                    <span>{item.brand}</span>
                    <span>{item.quantity}</span>
                    <span>{item.unitPrice} TL</span>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

export default FoodPackageCard
