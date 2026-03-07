import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    // Generation counter: ensures only the LATEST in-flight fetchProfile
    // can update state. Older fetches detect staleness and bail.
    const fetchGen = useRef(0)

    // ---------------------------------------------------------------------------
    // Fetch the profile row for a given userId.
    // gen: snapshot of fetchGen.current — detects if this fetch is stale.
    // Retries up to 3x (500ms apart) for new signups where DB trigger is delayed.
    // ---------------------------------------------------------------------------
    const fetchProfile = async (userId, gen) => {
        for (let attempt = 0; attempt < 3; attempt++) {
            if (gen !== fetchGen.current) return null  // bail: superseded

            try {
                const { data, error } = await supabase
                    .from('parkease_profiles')
                    .select('*')
                    .eq('id', userId)
                    .maybeSingle()

                if (gen !== fetchGen.current) return null  // stale after await

                if (data) {
                    setProfile(data)
                    setLoading(false)
                    return data
                }

                if (error && error.code !== 'PGRST116') {
                    console.error('[ParkEase] Profile fetch error:', error)
                }
            } catch (err) {
                if (gen !== fetchGen.current) return null
                if (attempt === 2) console.error('[ParkEase] Profile fetch failed:', err)
            }

            if (attempt < 2) await new Promise(r => setTimeout(r, 500))
        }

        if (gen === fetchGen.current) {
            setProfile(null)
            setLoading(false)
        }
        return null
    }

    useEffect(() => {
        let mounted = true

        // -----------------------------------------------------------------------
        // STEP 1: Initialize immediately using getSession().
        // getSession() reads directly from localStorage — no distributed lock
        // needed, so it resolves in <10ms even on page refresh or new tab.
        // This is the CORRECT way to get the initial session in Supabase v2.
        // -----------------------------------------------------------------------
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (!mounted) return

            const currentUser = session?.user ?? null
            const gen = ++fetchGen.current

            setUser(currentUser)

            if (currentUser) {
                await fetchProfile(currentUser.id, gen)
            } else {
                setLoading(false)
            }
        })

        // -----------------------------------------------------------------------
        // STEP 2: Subscribe to future auth events.
        // We explicitly SKIP INITIAL_SESSION here because getSession() above
        // already handled the initial state. Handling it twice causes race
        // conditions and flickering loading states.
        // -----------------------------------------------------------------------
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return

                // Skip: already handled synchronously via getSession() above
                if (event === 'INITIAL_SESSION') return

                const currentUser = session?.user ?? null
                const gen = ++fetchGen.current

                if (event === 'SIGNED_OUT') {
                    setUser(null)
                    setProfile(null)
                    setLoading(false)
                    return
                }

                // SIGNED_IN or TOKEN_REFRESHED
                setUser(currentUser)

                if (currentUser) {
                    await fetchProfile(currentUser.id, gen)
                } else {
                    setProfile(null)
                    if (mounted && gen === fetchGen.current) setLoading(false)
                }
            }
        )

        return () => {
            mounted = false
            subscription.unsubscribe()
        }
    }, [])  // eslint-disable-line react-hooks/exhaustive-deps

    const signOut = async () => {
        await supabase.auth.signOut()
    }

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            loading,
            signOut,
            fetchProfile: (id) => fetchProfile(id, ++fetchGen.current),
        }}>
            {children}
        </AuthContext.Provider>
    )
}



