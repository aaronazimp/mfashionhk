"use client"

import { useEffect, useState } from "react"
import { getSessionToken } from "@/lib/utils"

/**
 * Client hook that returns the persistent session token.
 * Initially `null` while hydrated on the client, then set to the token.
 */
export default function useSessionToken(): string | null {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    try {
      const t = getSessionToken()
      setToken(t)
    } catch (e) {
      setToken(null)
    }
  }, [])

  return token
}
