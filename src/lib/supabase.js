import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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
        storageKey: 'sb-amjrbnanzigqpggmvzgw-admin-token',
    }
})

