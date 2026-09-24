import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'

/** Fetch-on-mount with a reload handle. Keeps pages free of effect boilerplate. */
export function useApi(path, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    if (!path) return
    setLoading(true)
    api
      .get(path)
      .then((result) => {
        setData(result)
        setError(null)
      })
      .catch(setError)
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps])

  useEffect(load, [load])
  return { data, error, loading, reload: load, setData }
}
