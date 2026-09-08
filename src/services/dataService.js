import { supabase, isSupabaseConfigured } from '../supabaseClient'
import {
  orderToRequest,
  profileToUser,
  requestToOrder,
  uiStatusToDb,
  userToProfile,
} from './mappers'

const warn = (scope, error) => {
  console.warn(`[Mahalleli][Supabase:${scope}] fallback kullanılıyor`, error?.message || error)
}

function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Supabase zaman aşımı')), ms)
    }),
  ])
}

export async function withSupabase(scope, remoteFn, fallbackFn) {
  if (!isSupabaseConfigured || !supabase) {
    return fallbackFn()
  }
  try {
    return await withTimeout(remoteFn())
  } catch (error) {
    warn(scope, error)
    return fallbackFn()
  }
}

export async function fetchProfiles() {
  return withSupabase(
    'fetchProfiles',
    async () => {
      const { data, error } = await supabase.from('profiles').select('*')
      if (error) {
        throw error
      }
      return (data || []).map(profileToUser)
    },
    () => null,
  )
}

export async function upsertProfile(user) {
  return withSupabase(
    'upsertProfile',
    async () => {
      const payload = userToProfile(user)
      const { data, error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'tc_kimlik,role' })
        .select()
        .maybeSingle()
      if (error) {
        const { data: inserted, error: insertError } = await supabase
          .from('profiles')
          .insert(payload)
          .select()
          .maybeSingle()
        if (insertError) {
          const { data: updated, error: updateError } = await supabase
            .from('profiles')
            .update(payload)
            .eq('tc_kimlik', payload.tc_kimlik)
            .eq('role', payload.role)
            .select()
            .maybeSingle()
          if (updateError) {
            throw error
          }
          return profileToUser(updated) || user
        }
        return profileToUser(inserted) || user
      }
      return profileToUser(data) || user
    },
    () => user,
  )
}

function roleFilter(role) {
  if (role === 'merchant' || role === 'esnaf') {
    return ['merchant', 'esnaf']
  }
  return [role]
}

export async function findProfileByEmail(role, email) {
  const normalized = String(email || '').trim().toLocaleLowerCase('tr-TR')
  return withSupabase(
    'findProfileByEmail',
    async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', roleFilter(role))
        .ilike('email', normalized)
        .maybeSingle()
      if (error) {
        throw error
      }
      return profileToUser(data)
    },
    () => null,
  )
}

export async function findProfileByTc(role, tcKimlik) {
  return withSupabase(
    'findProfileByTc',
    async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', roleFilter(role))
        .eq('tc_kimlik', tcKimlik)
        .maybeSingle()
      if (error) {
        throw error
      }
      return profileToUser(data)
    },
    () => null,
  )
}

export async function setProfileApproved(tcKimlik, isApproved = true) {
  return withSupabase(
    'setProfileApproved',
    async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: isApproved })
        .eq('role', 'beneficiary')
        .eq('tc_kimlik', tcKimlik)
      if (error) {
        throw error
      }
      return true
    },
    () => false,
  )
}

export async function updateMerchantInventoryRemote(tcKimlik, name, inventory) {
  return withSupabase(
    'updateMerchantInventory',
    async () => {
      let query = supabase.from('profiles').update({ inventory }).in('role', ['merchant', 'esnaf'])
      query = tcKimlik ? query.eq('tc_kimlik', tcKimlik) : query.eq('name', name)
      const { error } = await query
      if (error) {
        throw error
      }
      return true
    },
    () => false,
  )
}

export async function fetchOrders() {
  return withSupabase(
    'fetchOrders',
    async () => {
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
      if (error) {
        throw error
      }
      return (data || []).map(orderToRequest)
    },
    () => null,
  )
}

export async function fetchMerchantOrders(merchantType) {
  return withSupabase(
    'fetchMerchantOrders',
    async () => {
      let query = supabase
        .from('orders')
        .select('*')
        .in('status', ['bekliyor', 'fonlandi', 'kuryeye_verildi'])
        .order('created_at', { ascending: true })

      if (merchantType) {
        query = query.eq('merchant_type', merchantType)
      }

      const { data, error } = await query
      if (error) {
        throw error
      }
      return (data || []).map(orderToRequest)
    },
    () => null,
  )
}

export async function insertOrder(request) {
  return withSupabase(
    'insertOrder',
    async () => {
      const payload = requestToOrder(request)
      const { data, error } = await supabase.from('orders').insert(payload).select().maybeSingle()
      if (error) {
        throw error
      }
      return orderToRequest(data) || request
    },
    () => request,
  )
}

export async function updateOrderRemote(requestId, patch) {
  return withSupabase(
    'updateOrder',
    async () => {
      const dbPatch = {}
      if (patch.status) {
        dbPatch.status = uiStatusToDb(patch.status)
      }
      if (patch.donorName !== undefined) {
        dbPatch.donor_name = patch.donorName
      }
      if (patch.merchantName !== undefined) {
        dbPatch.merchant_name = patch.merchantName
      }
      if (patch.merchantType !== undefined) {
        dbPatch.merchant_type = patch.merchantType
      }
      if (patch.qrCode !== undefined) {
        dbPatch.qr_code = patch.qrCode
      }
      if (patch.fundedAt !== undefined) {
        dbPatch.funded_at = patch.fundedAt
      }
      if (patch.deliveredAt !== undefined) {
        dbPatch.delivered_at = patch.deliveredAt
      }
      if (patch.courierHandoffAt !== undefined) {
        dbPatch.courier_handoff_at = patch.courierHandoffAt
      }
      const { error } = await supabase.from('orders').update(dbPatch).eq('id', requestId)
      if (error) {
        throw error
      }
      return true
    },
    () => false,
  )
}

export async function fetchPoolBalanceRemote() {
  return withSupabase(
    'fetchPool',
    async () => {
      const { data, error } = await supabase.from('pool').select('balance').eq('id', 1).maybeSingle()
      if (error) {
        throw error
      }
      if (!data) {
        await supabase.from('pool').upsert({ id: 1, balance: 0 })
        return 0
      }
      const value = Number(data.balance)
      return Number.isFinite(value) ? value : 0
    },
    () => null,
  )
}

export async function writePoolBalanceRemote(balance) {
  const next = Math.max(0, Number(balance) || 0)
  return withSupabase(
    'writePool',
    async () => {
      const { error } = await supabase
        .from('pool')
        .upsert({ id: 1, balance: next, updated_at: new Date().toISOString() })
      if (error) {
        throw error
      }
      return next
    },
    () => next,
  )
}

export function subscribeRealtime(onChange) {
  if (!isSupabaseConfigured || !supabase) {
    return () => {}
  }
  try {
    const channel = supabase
      .channel('mahalleli-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool' }, onChange)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  } catch (error) {
    warn('subscribeRealtime', error)
    return () => {}
  }
}

export async function persistPoolFundingSideEffects(result) {
  if (!result) {
    return
  }
  try {
    await writePoolBalanceRemote(result.poolBalance)
    await Promise.all(
      (result.fundedRequests || []).map((request) =>
        updateOrderRemote(request.id, {
          status: 'funded',
          donorName: request.donorName,
          merchantName: request.merchantName,
          merchantType: request.merchantType,
          qrCode: request.qrCode,
          fundedAt: request.fundedAt,
        }),
      ),
    )
    await Promise.all(
      (result.merchants || [])
        .filter((merchant) => merchant.tcKimlik || merchant.name)
        .map((merchant) =>
          updateMerchantInventoryRemote(merchant.tcKimlik, merchant.name, merchant.inventory || []),
        ),
    )
  } catch (error) {
    warn('persistPoolFunding', error)
  }
}
