"use client"

import { useEffect, useState } from "react"
import { getSessionToken } from "@/lib/utils"

/**
 * Client hook that returns the persistent session token.
 * Initially `null` while hydrating on the client, then set to the token.
 * 
 * Will retry on failure and should eventually return a token
 * (either from localStorage or in-memory fallback).
 */
export default function useSessionToken(): string | null {
  const [token, setToken] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    try {
      const t = getSessionToken()
      if (t) {
        setToken(t)
        // Log successful token retrieval in development
        if (process.env.NODE_ENV === 'development') {
          console.debug('Session token loaded:', t.substring(0, 8) + '...')
        }
      }
    } catch (e) {
      console.error('Failed to get session token:', e)
      // Retry once after a short delay
      if (retryCount === 0) {
        const timeout = setTimeout(() => {
          setRetryCount(1)
        }, 500)
        return () => clearTimeout(timeout)
      }
    }
  }, [retryCount])

  return token
}
