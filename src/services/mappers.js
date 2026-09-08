export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ''),
  )
}

const ORDER_STATUS_TO_UI = {
  bekliyor: 'requested',
  fonlandi: 'funded',
  kuryeye_verildi: 'courier_dispatched',
  teslim_edildi: 'delivered',
  requested: 'requested',
  funded: 'funded',
  courier_dispatched: 'courier_dispatched',
  delivered: 'delivered',
}

const UI_STATUS_TO_DB = {
  requested: 'bekliyor',
  funded: 'fonlandi',
  courier_dispatched: 'kuryeye_verildi',
  delivered: 'teslim_edildi',
}

export function profileToUser(row) {
  if (!row) {
    return null
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    tcKimlik: row.tc_kimlik,
    phone: row.phone || '',
    address: row.address || '',
    neighborhood: row.neighborhood,
    city: row.city,
    district: row.district,
    unit: row.unit,
    role: row.role === 'esnaf' ? 'merchant' : row.role,
    merchantType: row.merchant_type,
    inventory: Array.isArray(row.inventory) ? row.inventory : [],
    isApproved: row.role === 'beneficiary' ? Boolean(row.is_approved) : true,
  }
}

export function userToProfile(user) {
  const payload = {
    tc_kimlik: user.tcKimlik,
    email: user.email,
    password: user.password,
    name: user.name,
    role: user.role,
    phone: user.phone || null,
    address: user.address || null,
    neighborhood: user.neighborhood || null,
    city: user.city || null,
    district: user.district || null,
    unit: user.unit || null,
    merchant_type: user.merchantType || null,
    inventory: user.inventory || [],
    is_approved:
      user.role === 'beneficiary'
        ? Boolean(user.isApproved || user.municipalityApproved)
        : true,
  }
  if (isUuid(user.id)) {
    payload.id = user.id
  }
  return payload
}

export function orderToRequest(row) {
  if (!row) {
    return null
  }
  const items = Array.isArray(row.items) ? row.items : []
  const productIds = items
    .map((item) => item.productId || item.id)
    .filter(Boolean)
  const deliveryType = row.delivery_type
  const deliveryMethod =
    deliveryType === 'kurye' || deliveryType === 'courier' ? 'courier' : 'pickup'

  return {
    id: row.id,
    beneficiaryName: row.beneficiary_name,
    beneficiaryTc: row.requester_tc,
    productIds,
    items,
    productTotal: Number(row.product_total) || 0,
    courierFee: Number(row.courier_fee) || 0,
    deliveryMethod,
    totalAmount: Number(row.total_price) || 0,
    status: ORDER_STATUS_TO_UI[row.status] || row.status,
    donorName: row.donor_name,
    merchantName: row.merchant_name,
    merchantType: row.merchant_type,
    qrCode: row.qr_code,
    createdAt: row.created_at,
    fundedAt: row.funded_at,
    deliveredAt: row.delivered_at,
    courierHandoffAt: row.courier_handoff_at,
    proxyCreatedBy: row.proxy_created_by,
    fundedByPool: row.donor_name === 'Genel Havuz',
  }
}

export function requestToOrder(request) {
  const items = (request.items && request.items.length
    ? request.items
    : (request.productIds || []).map((productId) => ({ productId }))
  )
  const payload = {
    requester_tc: request.beneficiaryTc || null,
    beneficiary_name: request.beneficiaryName,
    merchant_name: request.merchantName || null,
    merchant_type: request.merchantType || null,
    items,
    product_total: request.productTotal ?? request.totalAmount ?? 0,
    courier_fee: request.courierFee || 0,
    total_price: request.totalAmount || 0,
    delivery_type: request.deliveryMethod === 'courier' ? 'courier' : 'pickup',
    status: UI_STATUS_TO_DB[request.status] || request.status || 'bekliyor',
    donor_name: request.donorName || null,
    qr_code: request.qrCode || null,
    funded_at: request.fundedAt || null,
    delivered_at: request.deliveredAt || null,
    courier_handoff_at: request.courierHandoffAt || null,
    proxy_created_by: request.proxyCreatedBy || null,
    created_at: request.createdAt || new Date().toISOString(),
  }
  if (isUuid(request.id)) {
    payload.id = request.id
  }
  return payload
}

export function uiStatusToDb(status) {
  return UI_STATUS_TO_DB[status] || status
}
