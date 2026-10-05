import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { verifyPassword } from '../services/verifyPassword'
import { AuthContext, type AuthContextValue } from './authContext'

// Session-scoped: closing the app or tab signs the user out
const SESSION_KEY = 'saveha.authenticated'

function readSession(): boolean {
  if (__DEVELOPMENT__) return true
  try {
    return sessionStorage.getItem(SESSION_KEY) === 'true'
  } catch {
    return false
  }
}

function writeSession(authenticated: boolean) {
  try {
    if (authenticated) sessionStorage.setItem(SESSION_KEY, 'true')
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Storage unavailable (private mode, blocked): stay signed in for this page load only
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(readSession)

  const signIn = useCallback(async (password: string) => {
    const valid = await verifyPassword(password)
    if (valid) {
      writeSession(true)
      setIsAuthenticated(true)
    }
    return valid
  }, [])

  const signOut = useCallback(() => {
    writeSession(false)
    setIsAuthenticated(false)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthenticated, signIn, signOut }),
    [isAuthenticated, signIn, signOut],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
