import { useEffect, useRef } from 'react'
import { INACTIVITY_LOGOUT_MS } from '../config/permissions'

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'visibilitychange']

/**
 * Signs the user out after `timeoutMs` without pointer/keyboard activity.
 */
export function useInactivityLogout(enabled, onTimeout, timeoutMs = INACTIVITY_LOGOUT_MS) {
  const timerRef = useRef(null)
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  useEffect(() => {
    if (!enabled) return undefined

    function clear() {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    function arm() {
      clear()
      timerRef.current = window.setTimeout(() => {
        onTimeoutRef.current?.()
      }, timeoutMs)
    }

    function onActivity() {
      if (document.visibilityState === 'hidden') return
      arm()
    }

    arm()
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true })
    }

    return () => {
      clear()
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity)
      }
    }
  }, [enabled, timeoutMs])
}
