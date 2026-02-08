import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns a persistent session token stored under 'reels_session_token'.
 * If running on the server this will throw — this utility is intended
 * for client-side usage (call from effects or client components).
 */
export function getSessionToken(): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    throw new Error('getSessionToken must be called on the client')
  }

  // Use the flash sale session key so it matches existing usage in the app
  const key = 'flash_sale_session_token'
  let token = localStorage.getItem(key)
  if (token) return token

  token = crypto.randomUUID()
  localStorage.setItem(key, token)
  return token
}
