import { Bike, CarFront } from 'lucide-react'

export default function CapacityWidget({ capacity }) {
    const getCapacityColor = (pct) => pct >= 90 ? '#f43f5e' : pct >= 70 ? '#f59e0b' : '#10b981'

    const twCapacity = capacity.filter(c => c.vehicle_type === 'two_wheeler')
    const fwCapacity = capacity.filter(c => c.vehicle_type === 'four_wheeler')

    // Use available_slots directly (computed in fetchCapacity)
    const twTotal = twCapacity.reduce((s, c) => s + (c.total_slots || 0), 0)
    const twAvail = twCapacity.reduce((s, c) => s + (c.available_slots || 0), 0)
    const fwTotal = fwCapacity.reduce((s, c) => s + (c.total_slots || 0), 0)
    const fwAvail = fwCapacity.reduce((s, c) => s + (c.available_slots || 0), 0)

    const twPct = twTotal > 0 ? ((twTotal - twAvail) / twTotal) * 100 : 0
    const fwPct = fwTotal > 0 ? ((fwTotal - fwAvail) / fwTotal) * 100 : 0

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div className="stat-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Bike size={16} color="#818cf8" />
                    <span className="stat-label">2-Wheeler</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: getCapacityColor(twPct) }}>
                    {twAvail} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>/ {twTotal} free</span>
                </div>
                <div className="capacity-bar" style={{ marginTop: 6 }}>
                    <div className="capacity-bar-fill" style={{ width: `${twPct}%`, background: getCapacityColor(twPct) }} />
                </div>
            </div>
            <div className="stat-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <CarFront size={16} color="#f59e0b" />
                    <span className="stat-label">4-Wheeler</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: getCapacityColor(fwPct) }}>
                    {fwAvail} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>/ {fwTotal} free</span>
                </div>
                <div className="capacity-bar" style={{ marginTop: 6 }}>
                    <div className="capacity-bar-fill" style={{ width: `${fwPct}%`, background: getCapacityColor(fwPct) }} />
                </div>
            </div>
        </div>
    )
}
