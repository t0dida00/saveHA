import { createContext } from 'react'

export type AuthContextValue = {
  isAuthenticated: boolean
  /** Resolves to true when the password is correct and the user is signed in. */
  signIn: (password: string) => Promise<boolean>
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
