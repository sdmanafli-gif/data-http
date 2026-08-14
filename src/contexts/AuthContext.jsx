import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { MFA_REQUIRED } from '../config/auth'
import { supabase, supabaseConfigured } from '../lib/supabase'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

const emptyMfa = {
  currentLevel: null,
  nextLevel: null,
  hasTotp: false,
  needsChallenge: false,
  needsEnroll: false,
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mfa, setMfa] = useState(emptyMfa)
  const [mfaLoading, setMfaLoading] = useState(false)

  /**
   * Pass the known session when possible — never call getSession() from inside
   * onAuthStateChange (Supabase auth lock deadlock → infinite "Yüklənir…").
   */
  const refreshMfaStatus = useCallback(async (knownSession) => {
    if (!supabase) {
      setMfa(emptyMfa)
      return emptyMfa
    }

    try {
      let active = knownSession
      if (!active) {
        const {
          data: { session: s },
        } = await supabase.auth.getSession()
        active = s
      }
      if (!active?.user) {
        setMfa(emptyMfa)
        return emptyMfa
      }

      const [{ data: aal, error: aalError }, { data: factors, error: factorsError }] =
        await Promise.all([
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.mfa.listFactors(),
        ])

      if (aalError || factorsError) {
        console.warn('MFA status error:', aalError?.message || factorsError?.message)
        const fallback = {
          ...emptyMfa,
          currentLevel: aal?.currentLevel ?? 'aal1',
          nextLevel: aal?.nextLevel ?? 'aal1',
          needsEnroll: Boolean(MFA_REQUIRED),
        }
        setMfa(fallback)
        return fallback
      }

      const hasTotp = (factors?.totp ?? []).some((f) => f.status === 'verified')
      const currentLevel = aal?.currentLevel ?? 'aal1'
      const nextLevel = aal?.nextLevel ?? 'aal1'
      const needsChallenge = currentLevel === 'aal1' && nextLevel === 'aal2'
      const needsEnroll = Boolean(MFA_REQUIRED && currentLevel === 'aal1' && !hasTotp)

      const next = { currentLevel, nextLevel, hasTotp, needsChallenge, needsEnroll }
      setMfa(next)
      return next
    } catch (err) {
      console.warn('MFA status failed:', err)
      // Don't block the app if MFA APIs are unavailable
      const fallback = {
        ...emptyMfa,
        currentLevel: 'aal1',
        nextLevel: 'aal1',
        needsEnroll: Boolean(MFA_REQUIRED),
      }
      setMfa(fallback)
      return fallback
    }
  }, [])

  async function fetchProfile(userId) {
    if (!supabase) return
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
    }
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return undefined
    }

    let cancelled = false

    async function bootstrap(activeSession) {
      if (cancelled) return
      setSession(activeSession)
      if (activeSession?.user?.id) {
        await Promise.all([
          fetchProfile(activeSession.user.id),
          refreshMfaStatus(activeSession),
        ])
      } else {
        setProfile(null)
        setMfa(emptyMfa)
      }
    }

    ;(async () => {
      try {
        const {
          data: { session: s },
        } = await supabase.auth.getSession()
        await bootstrap(s)
      } catch (err) {
        console.warn('Auth bootstrap failed:', err)
        setSession(null)
        setProfile(null)
        setMfa(emptyMfa)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      // Defer work so we don't hold the Supabase auth lock (deadlock risk).
      setTimeout(() => {
        ;(async () => {
          try {
            await bootstrap(s)
          } catch (err) {
            console.warn('Auth state update failed:', err)
          } finally {
            if (!cancelled) setLoading(false)
          }
        })()
      }, 0)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [refreshMfaStatus])

  async function signIn(email, password) {
    if (!supabase) throw new Error('Supabase konfiqurasiya olunmayıb.')
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw error
    // Session update is handled by onAuthStateChange (deferred).
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
      return { ...data, needsEmailConfirmation: true }
    }
    return data
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut()
    setProfile(null)
    setMfa(emptyMfa)
  }

  async function enrollTotp(friendlyName = 'Mobideal') {
    if (!supabase) throw new Error('Supabase konfiqurasiya olunmayıb.')
    setMfaLoading(true)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName,
      })
      if (error) throw error
      return data
    } finally {
      setMfaLoading(false)
    }
  }

  async function verifyTotpEnrollment({ factorId, code }) {
    if (!supabase) throw new Error('Supabase konfiqurasiya olunmayıb.')
    setMfaLoading(true)
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      })
      if (challengeError) throw challengeError

      const { data, error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      })
      if (error) throw error
      await refreshMfaStatus(data?.session ?? null)
      return data
    } finally {
      setMfaLoading(false)
    }
  }

  async function verifyTotpLogin(code) {
    if (!supabase) throw new Error('Supabase konfiqurasiya olunmayıb.')
    setMfaLoading(true)
    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
      if (factorsError) throw factorsError

      const totpFactor = (factors?.totp ?? []).find((f) => f.status === 'verified')
      if (!totpFactor) throw new Error('Authenticator quraşdırılmayıb.')

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      })
      if (challengeError) throw challengeError

      const { data, error } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code: code.trim(),
      })
      if (error) throw error
      await refreshMfaStatus(data?.session ?? null)
      return data
    } finally {
      setMfaLoading(false)
    }
  }

  async function unenrollTotp(factorId) {
    if (!supabase) throw new Error('Supabase konfiqurasiya olunmayıb.')
    setMfaLoading(true)
    try {
      const { data, error } = await supabase.auth.mfa.unenroll({ factorId })
      if (error) throw error
      await refreshMfaStatus()
      return data
    } finally {
      setMfaLoading(false)
    }
  }

  async function listTotpFactors() {
    if (!supabase) throw new Error('Supabase konfiqurasiya olunmayıb.')
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) throw error
    return data?.totp ?? []
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
    mfa,
    mfaLoading,
    mfaRequired: MFA_REQUIRED,
    configured: supabaseConfigured,
    signIn,
    signUp,
    signOut,
    enrollTotp,
    verifyTotpEnrollment,
    verifyTotpLogin,
    unenrollTotp,
    listTotpFactors,
    refreshMfaStatus,
    createInvitation,
    listInvitations,
    refreshProfile: () => (session?.user?.id ? fetchProfile(session.user.id) : null),
    isAdmin: profile?.role === 'admin',
    isManager: profile?.role === 'manager',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
