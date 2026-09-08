import { useEffect, useMemo, useState } from 'react'
import { ROLE_FIELDS, ROLES } from '../data/roles'
import {
  CITIES,
  DEFAULT_CITY,
  DEFAULT_DISTRICT,
  DEFAULT_NEIGHBORHOOD,
  NEIGHBORHOODS,
  getDistrictsForCity,
} from '../data/locations'
import { MERCHANT_TYPES } from '../data/merchantTypes'
import { MUNICIPALITY_UNITS } from '../data/municipalityUnits'
import { getProductsForMerchantType } from '../data/products'
import SearchableSelect from './SearchableSelect'
import ProductImage from './ProductImage'

const emptyValues = {
  name: '',
  email: '',
  tcKimlik: '',
  phone: '0',
  address: '',
  neighborhood: DEFAULT_NEIGHBORHOOD,
  city: DEFAULT_CITY,
  district: DEFAULT_DISTRICT,
  taxId: '',
  unit: MUNICIPALITY_UNITS[0].id,
  merchantType: 'market',
  inventory: [],
  password: '',
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) {
    return '0'
  }
  const withoutLeadingZeros = digits.replace(/^0+/, '')
  return `0${withoutLeadingZeros}`.slice(0, 11)
}

function AuthCard({ role, onRegister, onLogin }) {
  const [mode, setMode] = useState('register')
  const [form, setForm] = useState(emptyValues)
  const roleConfig = useMemo(() => ROLES.find((item) => item.id === role), [role])
  const fields = ROLE_FIELDS[role]
  const isMerchantRegister = role === 'merchant' && mode === 'register'
  const merchantProducts = useMemo(
    () => getProductsForMerchantType(form.merchantType),
    [form.merchantType],
  )
  const districtOptions = useMemo(() => getDistrictsForCity(form.city), [form.city])

  useEffect(() => {
    setMode('register')
    setForm(emptyValues)
  }, [role])

  useEffect(() => {
    if (!isMerchantRegister) {
      return
    }
    setForm((current) => ({
      ...current,
      inventory: current.inventory.filter((row) =>
        merchantProducts.some((product) => product.id === row.productId),
      ),
    }))
  }, [form.merchantType, isMerchantRegister, merchantProducts])

  useEffect(() => {
    if (!districtOptions.includes(form.district)) {
      setForm((current) => ({ ...current, district: districtOptions[0] || '' }))
    }
  }, [districtOptions, form.district])

  const visibleFields =
    mode === 'login'
      ? fields.filter((field) => ['email', 'password'].includes(field.name))
      : fields

  const setField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      if (mode === 'register') {
        await onRegister(role, {
          ...form,
          inventory: role === 'merchant' ? form.inventory : [],
          neighborhood: role === 'municipality' ? undefined : form.neighborhood,
        })
      } else {
        await onLogin(role, form)
      }
    } catch (error) {
      console.warn('[Mahalleli] kimlik işlemi başarısız', error)
    } finally {
      setForm((current) => ({ ...current, password: '' }))
    }
  }

  const renderField = (field) => {
    if (field.type === 'neighborhood') {
      return (
        <SearchableSelect
          options={NEIGHBORHOODS}
          value={form.neighborhood}
          onChange={(value) => setField('neighborhood', value)}
          placeholder="Mahalle ara veya seçin…"
          required
        />
      )
    }
    if (field.type === 'city') {
      return (
        <SearchableSelect
          options={CITIES}
          value={form.city}
          onChange={(value) => setField('city', value)}
          placeholder="İl ara veya seçin…"
          required
        />
      )
    }
    if (field.type === 'district') {
      return (
        <SearchableSelect
          options={districtOptions}
          value={form.district}
          onChange={(value) => setField('district', value)}
          placeholder="İlçe ara veya seçin…"
          required
        />
      )
    }
    if (field.type === 'municipalityUnit') {
      return (
        <SearchableSelect
          options={MUNICIPALITY_UNITS.map((item) => ({ value: item.id, label: item.label }))}
          value={form.unit}
          onChange={(value) => setField('unit', value)}
          placeholder="Birim ara veya seçin…"
          required
        />
      )
    }
    if (field.type === 'merchantType') {
      return (
        <SearchableSelect
          options={MERCHANT_TYPES.map((type) => ({ value: type.id, label: type.label }))}
          value={form.merchantType}
          onChange={(value) => setField('merchantType', value)}
          placeholder="İşletme tipi seçin…"
          required
        />
      )
    }

    if (field.name === 'phone') {
      return (
        <div className="phone-input-group">
          <span className="phone-prefix" aria-hidden="true">
            0
          </span>
          <input
            required
            type="tel"
            inputMode="numeric"
            maxLength={10}
            className="phone-input-field"
            value={String(form.phone || '0').replace(/^0/, '')}
            onChange={(event) => setField('phone', normalizePhone(event.target.value))}
            placeholder="5XXXXXXXXX"
            aria-label="Telefon"
          />
        </div>
      )
    }

    const isTc = field.name === 'tcKimlik'

    return (
      <input
        required
        type={field.type}
        inputMode={isTc ? 'numeric' : undefined}
        maxLength={isTc ? 11 : undefined}
        value={form[field.name] || ''}
        onChange={(event) => {
          if (isTc) {
            setField(field.name, event.target.value.replace(/\D/g, '').slice(0, 11))
            return
          }
          setField(field.name, event.target.value)
        }}
        placeholder={`${field.label} giriniz`}
      />
    )
  }

  return (
    <section className="card">
      <div className="card-head">
        <p className="eyebrow">{roleConfig?.label}</p>
        <h2 className="tracking-tight">{mode === 'register' ? 'Kayıt Ol' : 'Giriş Yap'}</h2>
      </div>

      <div className="mode-switch">
        <button
          type="button"
          className={mode === 'register' ? 'selected' : ''}
          onClick={() => setMode('register')}
        >
          Kayıt
        </button>
        <button
          type="button"
          className={mode === 'login' ? 'selected' : ''}
          onClick={() => setMode('login')}
        >
          Giriş
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {visibleFields.map((field) => (
          <label key={field.name}>
            <span>{field.label}</span>
            {renderField(field)}
          </label>
        ))}
        {isMerchantRegister && (
          <fieldset className="soft-box">
            <legend>Stok Yönetimi — {MERCHANT_TYPES.find((t) => t.id === form.merchantType)?.label}</legend>
            <div className="flex flex-col gap-3">
              {merchantProducts.map((product) => {
                const row = form.inventory.find((i) => i.productId === product.id)
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
                      <p className="text-sm font-semibold text-emerald-600">{product.price} TL</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className={`switch ${isActive ? 'on' : ''}`}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            inventory: isActive
                              ? current.inventory.filter((i) => i.productId !== product.id)
                              : [...current.inventory, { productId: product.id, stock: 10 }],
                          }))
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
                          setForm((current) => ({
                            ...current,
                            inventory: current.inventory.map((i) =>
                              i.productId === product.id
                                ? { ...i, stock: Number.isFinite(value) ? value : 0 }
                                : i,
                            ),
                          }))
                        }}
                        placeholder="Stok"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </fieldset>
        )}
        <button className={`primary bg-gradient ${roleConfig?.accent}`} type="submit">
          {mode === 'register' ? 'Hesap Oluştur' : 'Panele Gir'}
        </button>
      </form>
    </section>
  )
}

export default AuthCard
