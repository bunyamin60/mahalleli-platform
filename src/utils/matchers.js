export function sanitizeEntityName(value) {
  return String(value || '')
    .split('(')[0]
    .trim()
    .toLocaleLowerCase('tr-TR')
}

export function namesMatch(left, right) {
  const a = sanitizeEntityName(left)
  const b = sanitizeEntityName(right)
  return Boolean(a) && a === b
}

export function findBySanitizedName(list, selected, getName = (item) => item.name) {
  const needle = sanitizeEntityName(selected)
  if (!needle || !Array.isArray(list)) {
    return undefined
  }
  return list.find((item) => sanitizeEntityName(getName(item)) === needle)
}

export function canonicalName(value) {
  return String(value || '').split('(')[0].trim()
}

export function isMerchantRole(role) {
  const normalized = String(role || '').trim().toLocaleLowerCase('tr-TR')
  return normalized === 'merchant' || normalized === 'esnaf'
}

export function merchantIdentityKey(user) {
  const tc = String(user?.tcKimlik || '').replace(/\D/g, '')
  if (tc.length === 11) {
    return `tc:${tc}`
  }
  if (user?.id) {
    return `id:${String(user.id)}`
  }
  return `name:${sanitizeEntityName(user?.name)}`
}

function merchantScore(user) {
  const stocked = (user.inventory || []).filter((row) => Number(row.stock) > 0).length
  const remote = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(user.id || ''),
  )
  return (remote ? 1000 : 0) + stocked * 10 + (user.tcKimlik ? 1 : 0)
}

function preferMerchant(current, next) {
  if (!current) {
    return next
  }
  if (!next) {
    return current
  }
  return merchantScore(next) >= merchantScore(current) ? next : current
}

export function uniqueMerchants(users = []) {
  const merchants = users.filter((user) => isMerchantRole(user.role))
  const byIdentity = new Map()
  for (const merchant of merchants) {
    const key = merchantIdentityKey(merchant)
    byIdentity.set(key, preferMerchant(byIdentity.get(key), { ...merchant, role: 'merchant' }))
  }
  const byName = new Map()
  for (const merchant of byIdentity.values()) {
    const nameKey = sanitizeEntityName(merchant.name)
    if (!nameKey) {
      continue
    }
    byName.set(nameKey, preferMerchant(byName.get(nameKey), merchant))
  }
  return [...byName.values()]
}

export function uniqueSelectOptions(options = []) {
  const seen = new Set()
  const unique = []
  for (const option of options) {
    const value = typeof option === 'string' ? option : option.value
    const key = sanitizeEntityName(value)
    if (!key || seen.has(key)) {
      continue
    }
    seen.add(key)
    unique.push(option)
  }
  return unique
}

export function collapseMerchantDuplicates(users = [], remoteUsers = null) {
  const others = users.filter((user) => !isMerchantRole(user.role))
  const remoteMerchants = Array.isArray(remoteUsers) ? remoteUsers.filter((user) => isMerchantRole(user.role)) : []
  const source = remoteMerchants.length ? uniqueMerchants(remoteMerchants) : uniqueMerchants(users)

  return [
    ...others,
    ...source.map((remote) => {
      const local = users.find(
        (user) =>
          isMerchantRole(user.role) &&
          (merchantIdentityKey(user) === merchantIdentityKey(remote) || namesMatch(user.name, remote.name)),
      )
      if (!local) {
        return { ...remote, role: 'merchant' }
      }
      return {
        ...local,
        ...remote,
        role: 'merchant',
        inventory: remote.inventory?.length ? remote.inventory : local.inventory,
      }
    }),
  ]
}
