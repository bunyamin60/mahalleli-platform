import { useEffect, useMemo, useState } from 'react'
import { ROLE_FIELDS, ROLES } from '../data/roles'
import { NEIGHBORHOODS } from '../data/neighborhoods'
import { AID_PACKAGES } from '../data/aidPackages'

const emptyValues = {
  name: '',
  email: '',
  neighborhood: NEIGHBORHOODS[0],
  taxId: '',
  unit: '',
  inventory: [],
  password: '',
}

function AuthCard({ role, onRegister, onLogin }) {
  const [mode, setMode] = useState('register')
  const [form, setForm] = useState(emptyValues)
  const roleConfig = useMemo(() => ROLES.find((item) => item.id === role), [role])
  const fields = ROLE_FIELDS[role]
  const isMerchantRegister = role === 'merchant' && mode === 'register'

  useEffect(() => {
    setMode('register')
    setForm(emptyValues)
  }, [role])

  const visibleFields =
    mode === 'login' ? fields.filter((field) => ['name', 'password'].includes(field.name)) : fields

  const handleSubmit = (event) => {
    event.preventDefault()
    if (mode === 'register') {
      onRegister(role, {
        ...form,
        inventory: role === 'merchant' ? form.inventory : [],
      })
    } else {
      onLogin(role, form)
    }
    setForm((current) => ({ ...current, password: '' }))
  }

  return (
    <section className="card">
      <div className="card-head">
        <p className="eyebrow">{roleConfig?.label}</p>
        <h2>{mode === 'register' ? 'Kayıt Ol' : 'Giriş Yap'}</h2>
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
            {field.type === 'select' ? (
              <select
                value={form[field.name]}
                onChange={(event) =>
                  setForm((current) => ({ ...current, [field.name]: event.target.value }))
                }
              >
                {NEIGHBORHOODS.map((neighborhood) => (
                  <option key={neighborhood} value={neighborhood}>
                    {neighborhood}
                  </option>
                ))}
              </select>
            ) : (
              <input
                required
                type={field.type}
                value={form[field.name]}
                onChange={(event) =>
                  setForm((current) => ({ ...current, [field.name]: event.target.value }))
                }
                placeholder={`${field.label} giriniz`}
              />
            )}
          </label>
        ))}
        {isMerchantRegister && (
          <fieldset className="soft-box">
            <legend>Stok Yönetimi</legend>
            <div className="stock-list">
              {AID_PACKAGES.map((pkg) => {
                const row = form.inventory.find((i) => i.packageId === pkg.id)
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
                          setForm((current) => ({
                            ...current,
                            inventory: isActive
                              ? current.inventory.filter((i) => i.packageId !== pkg.id)
                              : [...current.inventory, { packageId: pkg.id, stock: 10 }],
                          }))
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
                          setForm((current) => ({
                            ...current,
                            inventory: current.inventory.map((i) =>
                              i.packageId === pkg.id ? { ...i, stock: Number.isFinite(value) ? value : 0 } : i,
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