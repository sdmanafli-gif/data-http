import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import './SupabaseStatus.css'

export default function SupabaseStatus() {
  const [status, setStatus] = useState('checking') // checking | connected | error | missing

  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key || url.includes('your-project')) {
      setStatus('missing')
      return
    }
    supabase
      .from('musteri_bazasi')
      .select('id', { count: 'exact', head: true })
      .then(({ error }) => setStatus(error ? 'error' : 'connected'))
      .catch(() => setStatus('error'))
  }, [])

  if (status === 'checking') {
    return (
      <div className="supabase-status supabase-status--checking">
        Supabase yoxlanılır…
      </div>
    )
  }
  if (status === 'connected') {
    return (
      <div className="supabase-status supabase-status--connected">
        Supabase bağlı
      </div>
    )
  }
  if (status === 'missing') {
    return (
      <div className="supabase-status supabase-status--missing" title=".env faylına VITE_SUPABASE_URL və VITE_SUPABASE_ANON_KEY əlavə edin">
        Supabase təyin edilməyib
      </div>
    )
  }
  return (
    <div className="supabase-status supabase-status--error" title="URL və ya anon key yoxlanılsın; cədvəllər yaradılıb?">
      Supabase xətası
    </div>
  )
}
