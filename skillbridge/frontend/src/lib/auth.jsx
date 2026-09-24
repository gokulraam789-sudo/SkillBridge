import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    api
      .get('/auth/me')
      .then(setUser)
      .catch(() => setToken(''))
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      async signIn(email, password) {
        const data = await api.post('/auth/login', { email, password })
        setToken(data.token)
        setUser(data.user)
        return data.user
      },
      async signUp(payload) {
        const data = await api.post('/auth/register', payload)
        setToken(data.token)
        setUser(data.user)
        return data.user
      },
      async refresh() {
        const me = await api.get('/auth/me')
        setUser(me)
        return me
      },
      signOut() {
        setToken('')
        setUser(null)
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export const HOME = {
  student: '/student',
  institute: '/institute',
  industry: '/industry',
  admin: '/admin',
}
