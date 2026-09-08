export const POOL_BALANCE_KEY = 'mahalleli_pool_balance'
export const POOL_WAIT_DAYS = 3
const MS_PER_DAY = 24 * 60 * 60 * 1000

export function readPoolBalance() {
  try {
    const raw = localStorage.getItem(POOL_BALANCE_KEY)
    const value = Number(raw)
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

export function writePoolBalance(balance) {
  localStorage.setItem(POOL_BALANCE_KEY, String(Math.max(0, balance)))
  window.dispatchEvent(new CustomEvent('mahalleli-pool-updated'))
}

export function daysSince(isoDate) {
  if (!isoDate) {
    return 0
  }
  const diff = Date.now() - new Date(isoDate).getTime()
  return Math.floor(diff / MS_PER_DAY)
}

export function isEligibleForPoolFunding(request) {
  return request.status === 'requested' && daysSince(request.createdAt) >= POOL_WAIT_DAYS
}

export function findMerchantForRequest(users, request, beneficiaryNeighborhood) {
  const needed = request.productIds.reduce((acc, productId) => {
    acc[productId] = (acc[productId] || 0) + 1
    return acc
  }, {})

  const candidates = users.filter(
    (user) =>
      user.role === 'merchant' &&
      user.neighborhood === beneficiaryNeighborhood &&
      (user.inventory || []).some((row) => row.stock > 0),
  )

  return (
    candidates.find((merchant) =>
      Object.entries(needed).every(([productId, qty]) => {
        const row = (merchant.inventory || []).find((item) => item.productId === productId)
        return (row?.stock || 0) >= qty
      }),
    ) || null
  )
}

export function buildFundedRequestUpdate(request, merchantName, donorLabel) {
  const qrCode =
    request.deliveryMethod === 'pickup'
      ? `MHL-REQ-${request.id.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`
      : null

  return {
    ...request,
    status: 'funded',
    donorName: donorLabel,
    merchantName,
    qrCode,
    fundedAt: new Date().toISOString(),
    fundedByPool: donorLabel === 'Genel Havuz',
  }
}

export function deductMerchantStock(users, merchantName, productIds) {
  const needed = productIds.reduce((acc, productId) => {
    acc[productId] = (acc[productId] || 0) + 1
    return acc
  }, {})

  return users.map((user) => {
    if (user.role !== 'merchant' || user.name !== merchantName) {
      return user
    }
    const inventory = (user.inventory || []).map((row) => {
      const dec = needed[row.productId] || 0
      if (!dec) {
        return row
      }
      return { ...row, stock: Math.max(0, (Number(row.stock) || 0) - dec) }
    })
    return { ...user, inventory }
  })
}

export function processPoolAutoFunding(state, poolBalanceInput) {
  let poolBalance = Number.isFinite(poolBalanceInput) ? poolBalanceInput : readPoolBalance()
  if (poolBalance <= 0) {
    return null
  }

  const eligible = state.requests
    .filter(isEligibleForPoolFunding)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  if (!eligible.length) {
    return null
  }

  let requests = [...state.requests]
  let users = [...state.users]
  let fundedCount = 0
  const fundedIds = []

  for (const request of eligible) {
    if (poolBalance < request.totalAmount) {
      break
    }
    const beneficiary = users.find(
      (user) => user.role === 'beneficiary' && user.name === request.beneficiaryName,
    )
    const merchant = findMerchantForRequest(users, request, beneficiary?.neighborhood)
    if (!merchant) {
      continue
    }

    poolBalance -= request.totalAmount
    users = deductMerchantStock(users, merchant.name, request.productIds)
    requests = requests.map((item) =>
      item.id === request.id
        ? buildFundedRequestUpdate(item, merchant.name, 'Genel Havuz')
        : item,
    )
    fundedIds.push(request.id)
    fundedCount += 1
  }

  if (!fundedCount) {
    return null
  }

  writePoolBalance(poolBalance)
  const nextState = {
    ...state,
    users,
    requests,
    message: `${fundedCount} talep genel havuzdan otomatik fonlandı.`,
  }
  return {
    state: nextState,
    poolBalance,
    fundedRequests: requests.filter((item) => fundedIds.includes(item.id)),
    merchants: users.filter((user) => user.role === 'merchant'),
  }
}
