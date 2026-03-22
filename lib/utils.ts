import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// In-memory fallback for session tokens (used when localStorage is unavailable)
let _fallbackToken: string | null = null

/**
 * Returns a persistent session token stored under 'flash_sale_session_token'.
 * If running on the server this will throw — this utility is intended
 * for client-side usage (call from effects or client components).
 * 
 * Falls back to in-memory storage if localStorage is unavailable (e.g., privacy mode).
 */
export function getSessionToken(): string {
  if (typeof window === 'undefined') {
    throw new Error('getSessionToken must be called on the client')
  }

  const key = 'flash_sale_session_token'
  
  // Try to get token from localStorage first
  if (typeof localStorage !== 'undefined') {
    try {
      let token = localStorage.getItem(key)
      if (token) return token
    } catch (e) {
      console.warn('localStorage.getItem failed:', e)
    }
  }
  
  // If localStorage is available and empty, try to create a new token
  if (typeof localStorage !== 'undefined') {
    try {
      const newToken = _generateUUID()
      localStorage.setItem(key, newToken)
      return newToken
    } catch (e) {
      console.warn('localStorage.setItem failed (may be in privacy mode):', e)
      // Fall through to memory fallback
    }
  }
  
  // Fallback: use in-memory token for private/incognito mode
  if (!_fallbackToken) {
    _fallbackToken = _generateUUID()
    console.info('Using in-memory session token (localStorage unavailable)')
  }
  return _fallbackToken
}

/**
 * Generates a UUID v4 string, with fallback for older browsers
 */
function _generateUUID(): string {
  // Try native crypto.randomUUID (available in modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID()
    } catch (e) {
      console.warn('crypto.randomUUID failed:', e)
    }
  }
  
  // Fallback: generate UUID v4 manually
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
