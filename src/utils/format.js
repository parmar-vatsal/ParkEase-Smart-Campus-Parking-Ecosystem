export const formatDuration = (mins) => {
    if (!mins) return '-'
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export const formatDate = (dateString, includeTime = true) => {
    if (!dateString) return '-'
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }
    if (includeTime) {
        options.hour = '2-digit'
        options.minute = '2-digit'
    }
    return new Date(dateString).toLocaleDateString(undefined, options)
}

export const getCapacityColor = (pct) => 
    pct >= 90 ? '#f43f5e' : pct >= 70 ? '#f59e0b' : '#10b981'
