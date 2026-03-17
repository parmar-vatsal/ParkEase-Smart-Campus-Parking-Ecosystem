import { createClient } from '@supabase/supabase-js'

const normalizeSupabaseUrl = (url) => {
    const trimmedUrl = url?.trim()
    if (!trimmedUrl) return ''

    const withProtocol = /^https?:\/\//i.test(trimmedUrl)
        ? trimmedUrl
        : `https://${trimmedUrl}`

    return withProtocol.replace(/\/+$/, '')
}

const parseSupabaseUrl = (url) => {
    let parsedUrl
    try {
        parsedUrl = new URL(url)
    } catch (error) {
        throw new Error(`Invalid VITE_SUPABASE_URL "${url}". ${error.message}. Use format: https://<project-ref>.supabase.co`)
    }

    if (parsedUrl.protocol !== 'https:') {
        throw new Error('Invalid VITE_SUPABASE_URL protocol. Supabase URL must start with https://')
    }

    return parsedUrl
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

const parsedSupabaseUrl = parseSupabaseUrl(supabaseUrl)
const supabaseProjectRef = parsedSupabaseUrl.hostname.endsWith('.supabase.co')
    ? parsedSupabaseUrl.hostname.split('.')[0]
    : parsedSupabaseUrl.hostname.replace(/[^a-z0-9-]/gi, '-').toLowerCase()

// ---------------------------------------------------------------------------
// Custom in-memory lock function to replace Supabase's default browser
// Web Locks API (`navigator.locks.request`).
//
// WHY: Supabase's default lock causes `AbortError: Lock broken by another
// request with the 'steal' option` when getSession() and onAuthStateChange
// fire concurrently at page mount/refresh. Both fight over the same
// `lock:sb-*-auth-token` browser lock, one steals it from the other,
// causing the first call to abort — which means fetchProfile() never
// resolves and `loading` stays true forever (or profiles come back empty).
//
// This custom lock provides the same single-queue guarantee (one token
// refresh at a time within this tab) without using the browser Lock API,
// so the steal/abort cycle can never happen.
// ---------------------------------------------------------------------------
let _lockQueue = Promise.resolve()

function acquireLock(_name, _opts, callback) {
    const next = _lockQueue.then(() => callback())
    _lockQueue = next.catch(() => { })
    return next
}

// Primary client — manages the logged-in user's session
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        lock: acquireLock,
    },
})

// Secondary client for admin operations (e.g. creating guard accounts).
// Uses distinct storage to avoid ANY lock sharing with the primary client.
export const supabaseSecondary = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `sb-${supabaseProjectRef}-admin-token`,
    }
})
