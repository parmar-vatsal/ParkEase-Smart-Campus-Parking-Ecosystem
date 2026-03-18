import { useState, useEffect } from 'react'
import { getCapacityData } from '../utils/capacity'
import { POLLING_INTERVALS } from '../lib/constants'

export const useCapacity = (pollInterval = POLLING_INTERVALS.CAPACITY) => {
    const [capacity, setCapacity] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const fetchCapacity = async () => {
        const { data, error } = await getCapacityData()
        if (error) {
            setError(error.message)
        } else {
            setCapacity(data || [])
            setError(null)
        }
        setLoading(false)
    }

    useEffect(() => {
        let mounted = true
        let intervalId = null

        const init = async () => {
            if (!mounted) return
            await fetchCapacity()
            
            if (mounted && pollInterval > 0) {
                intervalId = setInterval(fetchCapacity, pollInterval)
            }
        }

        init()

        return () => {
            mounted = false
            if (intervalId) clearInterval(intervalId)
        }
    }, [pollInterval])

    return { capacity, loading, error, refreshCapacity: fetchCapacity }
}
