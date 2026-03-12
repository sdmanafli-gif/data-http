import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      if (s?.user?.id) fetchProfile(s.user.id, s.user.email)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s?.user?.id) fetchProfile(s.user.id, s.user.email)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId, userEmail) {
    const fallback = () => {
      setProfile({ role: 'store_manager', email: userEmail ?? null })
      setLoading(false)
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, email, display_name')
        .eq('id', userId)
        .single()
      if (error) {
        try {
          await supabase.from('profiles').upsert(
            { id: userId, role: 'store_manager', email: userEmail ?? null, updated_at: new Date().toISOString() },
            { onConflict: 'id' }
          )
          const { data: retry } = await supabase.from('profiles').select('id, role, email, display_name').eq('id', userId).single()
          setProfile(retry ?? { role: 'store_manager', email: userEmail ?? null })
        } catch (_) {
          fallback()
          return
        }
      } else {
        setProfile(data)
      }
    } catch (_) {
      fallback()
      return
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const value = {
    session,
    profile,
    loading,
    signIn,
    signOut,
    isAdmin: profile?.role === 'admin',
    isStoreManager: profile?.role === 'store_manager',
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
