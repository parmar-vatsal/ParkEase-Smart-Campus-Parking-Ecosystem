import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Car, Plus, MapPin, Clock, TrendingUp, Bike, CarFront } from 'lucide-react'

export default function StudentDashboard() {
    const { profile } = useAuth()
    const [vehicles, setVehicles] = useState([])
    const [capacity, setCapacity] = useState([])
    const [recentLogs, setRecentLogs] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        // Fetch user's vehicles
        const { data: vehicleData } = await supabase
            .from('parkease_vehicles')
            .select('*')
            .eq('owner_id', profile.id)
            .order('created_at', { ascending: false })

        // Fetch ALL active zones directly (not the view, which may miss new zones)
        const { data: zonesData } = await supabase
            .from('parkease_zones')
            .select('*')
            .eq('status', 'active')
            .order('name')

        // Fetch current occupancy from active parking logs
        const { data: activeLogs } = await supabase
            .from('parkease_logs')
            .select('zone_id, vehicle_type')
            .eq('status', 'inside')

        // Compute capacity rows dynamically so ALL zones always show
        const capacityRows = []
        for (const zone of (zonesData || [])) {
            // Count active vehicles in this zone by type
            const inside2w = (activeLogs || []).filter(l => l.zone_id === zone.id && l.vehicle_type === 'two_wheeler').length
            const inside4w = (activeLogs || []).filter(l => l.zone_id === zone.id && l.vehicle_type === 'four_wheeler').length

            if (zone.capacity_2w_total > 0) {
                const total = zone.capacity_2w_total + (zone.capacity_2w_overflow || 0)
                capacityRows.push({
                    zone_id: zone.id,
                    zone_name: zone.name,
                    zone_code: zone.code,
                    vehicle_type: 'two_wheeler',
                    total_slots: total,
                    available_slots: Math.max(0, total - inside2w),
                    occupancy_percent: total > 0 ? Math.round((inside2w / total) * 100) : 0
                })
            }
            if (zone.capacity_4w_total > 0) {
                const total = zone.capacity_4w_total + (zone.capacity_4w_overflow || 0)
                capacityRows.push({
                    zone_id: zone.id,
                    zone_name: zone.name,
                    zone_code: zone.code,
                    vehicle_type: 'four_wheeler',
                    total_slots: total,
                    available_slots: Math.max(0, total - inside4w),
                    occupancy_percent: total > 0 ? Math.round((inside4w / total) * 100) : 0
                })
            }
        }

        // Fetch recent logs for user
        const { data: logData } = await supabase
            .from('parkease_logs')
            .select('*, parkease_zones(name)')
            .eq('user_id', profile.id)
            .order('entry_time', { ascending: false })
            .limit(5)

        setVehicles(vehicleData || [])
        setCapacity(capacityRows)
        setRecentLogs(logData || [])
        setLoading(false)
    }

    const getCapacityColor = (percent) => {
        if (percent >= 90) return '#f43f5e'
        if (percent >= 70) return '#f59e0b'
        return '#10b981'
    }

    const totalTwoWheeler = capacity.filter(c => c.vehicle_type === 'two_wheeler')
    const totalFourWheeler = capacity.filter(c => c.vehicle_type === 'four_wheeler')
    const twAvailable = totalTwoWheeler.reduce((s, c) => s + (c.available_slots || 0), 0)
    const twTotal = totalTwoWheeler.reduce((s, c) => s + (c.total_slots || 0), 0)
    const fwAvailable = totalFourWheeler.reduce((s, c) => s + (c.available_slots || 0), 0)
    const fwTotal = totalFourWheeler.reduce((s, c) => s + (c.total_slots || 0), 0)

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}>
                <div className="spinner" style={{ width: 32, height: 32 }} />
            </div>
        )
    }

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                    Welcome, {profile.full_name?.split(' ')[0]} 👋
                </h1>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 4 }}>
                    {profile.department && `${profile.department} • `}{profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                    {profile.semester && ` • Sem ${profile.semester}`}
                </p>
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
                <div className="stat-card">
                    <Car size={20} color="#818cf8" />
                    <div className="stat-value" style={{ color: '#818cf8' }}>{vehicles.length}</div>
                    <div className="stat-label">My Vehicles</div>
                </div>
                <div className="stat-card">
                    <Bike size={20} color="#10b981" />
                    <div className="stat-value" style={{ color: '#10b981' }}>{twAvailable}</div>
                    <div className="stat-label">2W Slots Free</div>
                </div>
                <div className="stat-card">
                    <CarFront size={20} color="#f59e0b" />
                    <div className="stat-value" style={{ color: '#f59e0b' }}>{fwAvailable}</div>
                    <div className="stat-label">4W Slots Free</div>
                </div>
                <div className="stat-card">
                    <Clock size={20} color="#f43f5e" />
                    <div className="stat-value" style={{ color: '#f43f5e' }}>{recentLogs.length}</div>
                    <div className="stat-label">Recent Entries</div>
                </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
                <Link to="/student/register-vehicle" className="btn btn-primary">
                    <Plus size={16} /> Register Vehicle
                </Link>
                <Link to="/student/vehicles" className="btn btn-ghost">
                    <Car size={16} /> View My Vehicles
                </Link>
                <Link to="/student/guests" className="btn btn-ghost" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8' }}>
                    <Plus size={16} /> Invite Guest
                </Link>
            </div>

            {/* Live Capacity */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={18} color="#818cf8" />
                    Live Parking Capacity
                    <span className="badge badge-success" style={{ marginLeft: 'auto' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> LIVE
                    </span>
                </h2>
                <div style={{ display: 'grid', gap: 12 }}>
                    {capacity.map((zone) => (
                        <div key={zone.zone_id} style={{
                            padding: '14px 16px', borderRadius: 12,
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.05)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{zone.zone_name}</span>
                                    <span className={`badge ${zone.vehicle_type === 'two_wheeler' ? 'badge-info' : 'badge-warning'}`}
                                        style={{ marginLeft: 8 }}>
                                        {zone.vehicle_type === 'two_wheeler' ? '2W' : '4W'}
                                    </span>
                                </div>
                                <span style={{ fontSize: '0.8rem', color: getCapacityColor(zone.occupancy_percent), fontWeight: 600 }}>
                                    {zone.available_slots}/{zone.total_slots} free
                                </span>
                            </div>
                            <div className="capacity-bar">
                                <div
                                    className="capacity-bar-fill"
                                    style={{
                                        width: `${zone.occupancy_percent || 0}%`,
                                        background: getCapacityColor(zone.occupancy_percent),
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Activity */}
            {recentLogs.length > 0 && (
                <div className="glass-card" style={{ padding: 24 }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Clock size={18} color="#818cf8" />
                        Recent Activity
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {recentLogs.map((log) => (
                            <div key={log.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 14px', borderRadius: 10,
                                background: 'rgba(255,255,255,0.03)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: log.status === 'inside' ? '#10b981' : '#64748b',
                                    }} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{log.vehicle_number}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span className={`badge ${log.status === 'inside' ? 'badge-success' : 'badge-info'}`}>
                                        {log.status === 'inside' ? 'Inside' : 'Exited'}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        {new Date(log.entry_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
