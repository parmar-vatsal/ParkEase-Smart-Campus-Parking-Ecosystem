import { useState, useEffect, useCallback } from 'react'

export function useSupabaseQuery(queryFn, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const executeQuery = useCallback(async () => {
    let cancelled = false
    setLoading(true)
    setError(null)
    
    try {
        const { data, error } = await queryFn()
        if (cancelled) return
        
        if (error) setError(error.message)
        else setData(data)
    } catch (err) {
        if (!cancelled) setError(err.message)
    } finally {
        if (!cancelled) setLoading(false)
    }
    
    return () => { cancelled = true }
  }, deps)

  useEffect(() => {
    const cancelTimeout = executeQuery()
    return () => {
        if (cancelTimeout && typeof cancelTimeout === 'function') {
            cancelTimeout()
        }
    }
  }, [executeQuery])

  return { data, error, loading, refetch: executeQuery }
}