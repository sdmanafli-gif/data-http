import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'

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
    if (!supabase) {
      setLoading(false)
      return undefined
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      if (s?.user?.id) fetchProfile(s.user.id)
      else setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s?.user?.id) fetchProfile(s.user.id)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    if (!supabase) {
      setLoading(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, email, display_name, permissions')
        .eq('id', userId)
        .single()
      if (error) {
        setProfile(null)
      } else {
        setProfile(data)
      }
    } catch (_) {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email, password) {
    if (!supabase) throw new Error('Supabase konfiqurasiya olunmayıb.')
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw error
    return data
  }

  /**
   * Sign up. First account → admin (DB trigger).
   * Later accounts require a valid invite token → manager.
   */
  async function signUp({ email, password, displayName, inviteToken }) {
    if (!supabase) throw new Error('Supabase konfiqurasiya olunmayıb.')
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName?.trim() || null,
          invite_token: inviteToken || null,
        },
      },
    })
    if (error) throw error
    if (data.user && !data.session) {
      // Email confirmation may be enabled in Supabase
      return { ...data, needsEmailConfirmation: true }
    }
    return data
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut()
    setProfile(null)
  }

  async function createInvitation(email) {
    if (!supabase) throw new Error('Supabase konfiqurasiya olunmayıb.')
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Daxil olmamısınız.')

    const { data, error } = await supabase
      .from('invitations')
      .insert({
        email: email.trim().toLowerCase(),
        role: 'manager',
        invited_by: user.id,
      })
      .select('id, email, token, role, status, expires_at, created_at')
      .single()

    if (error) throw error
    return data
  }

  async function listInvitations() {
    if (!supabase) throw new Error('Supabase konfiqurasiya olunmayıb.')
    const { data, error } = await supabase
      .from('invitations')
      .select('id, email, token, role, status, expires_at, created_at, accepted_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }

  const value = {
    session,
    profile,
    loading,
    configured: supabaseConfigured,
    signIn,
    signUp,
    signOut,
    createInvitation,
    listInvitations,
    refreshProfile: () => (session?.user?.id ? fetchProfile(session.user.id) : null),
    isAdmin: profile?.role === 'admin',
    isManager: profile?.role === 'manager',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
