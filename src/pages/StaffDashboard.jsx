import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Car, Plus, TrendingUp, Clock, Bike, CarFront, BadgeCheck, Building2 } from 'lucide-react'

export default function StaffDashboard() {
    const { profile } = useAuth()
    const [vehicles, setVehicles] = useState([])
    const [capacity, setCapacity] = useState([])
    const [recentLogs, setRecentLogs] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        const [{ data: vehicleData }, { data: capData }, { data: logData }] = await Promise.all([
            supabase
                .from('parkease_vehicles')
                .select('*')
                .eq('owner_id', profile.id)
                .order('created_at', { ascending: false }),
            supabase.from('parkease_capacity').select('*'),
            supabase
                .from('parkease_logs')
                .select('*, parkease_zones(name)')
                .eq('user_id', profile.id)
                .order('entry_time', { ascending: false })
                .limit(5),
        ])

        setVehicles(vehicleData || [])
        setCapacity(capData || [])
        setRecentLogs(logData || [])
        setLoading(false)
    }

    const getCapacityColor = (percent) => {
        if (percent >= 90) return '#f43f5e'
        if (percent >= 70) return '#f59e0b'
        return '#10b981'
    }

    const twCapacity = capacity.filter(c => c.vehicle_type === 'two_wheeler')
    const fwCapacity = capacity.filter(c => c.vehicle_type === 'four_wheeler')
    const twAvailable = twCapacity.reduce((s, c) => s + (c.available_slots || 0), 0)
    const twTotal = twCapacity.reduce((s, c) => s + (c.total_slots || 0), 0)
    const fwAvailable = fwCapacity.reduce((s, c) => s + (c.available_slots || 0), 0)
    const fwTotal = fwCapacity.reduce((s, c) => s + (c.total_slots || 0), 0)

    const roleLabel = profile.role === 'faculty' ? 'Faculty Member' : 'Staff Member'
    const roleColor = profile.role === 'faculty' ? '#818cf8' : '#34d399'
    const roleBadge = profile.role === 'faculty' ? 'badge-info' : 'badge-success'

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
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                        Welcome, {profile.full_name?.split(' ')[0]} 👋
                    </h1>
                    <span className={`badge ${roleBadge}`} style={{ fontSize: '0.7rem' }}>
                        <BadgeCheck size={11} />
                        {roleLabel}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#94a3b8', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                    {profile.department && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Building2 size={13} />
                            {profile.department}
                        </span>
                    )}
                    {profile.employee_id && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <BadgeCheck size={13} />
                            ID: {profile.employee_id}
                        </span>
                    )}
                </div>
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
                <div className="stat-card">
                    <Car size={20} color={roleColor} />
                    <div className="stat-value" style={{ color: roleColor }}>{vehicles.length}</div>
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
                <Link to="/staff/register-vehicle" className="btn btn-primary">
                    <Plus size={16} /> Register Vehicle
                </Link>
                <Link to="/staff/vehicles" className="btn btn-ghost">
                    <Car size={16} /> My Vehicles
                </Link>
            </div>

            {/* Parking Notice for Staff */}
            <div className="glass-card" style={{
                padding: '14px 18px', marginBottom: 24,
                borderLeft: `4px solid ${roleColor}`,
                display: 'flex', alignItems: 'center', gap: 12,
            }}>
                <BadgeCheck size={20} color={roleColor} />
                <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'white', marginBottom: 2 }}>
                        {profile.role === 'faculty' ? 'Faculty Parking Privileges' : 'Staff Parking Access'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {profile.role === 'faculty'
                            ? 'Faculty members may park in designated faculty zones. Up to 3 two-wheelers and 1 four-wheeler permitted.'
                            : 'Staff members can park in designated staff/general zones. Up to 3 two-wheelers and 1 four-wheeler permitted.'}
                    </div>
                </div>
            </div>

            {/* Live Capacity */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={18} color={roleColor} />
                    Live Parking Capacity
                    <span className="badge badge-success" style={{ marginLeft: 'auto' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> LIVE
                    </span>
                </h2>
                {capacity.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center' }}>No capacity data available</p>
                ) : (
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
                                    <div className="capacity-bar-fill" style={{
                                        width: `${zone.occupancy_percent || 0}%`,
                                        background: getCapacityColor(zone.occupancy_percent),
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Recent Activity */}
            {recentLogs.length > 0 && (
                <div className="glass-card" style={{ padding: 24 }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Clock size={18} color={roleColor} />
                        Recent Parking Activity
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
                                    {log.parkease_zones?.name && (
                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>• {log.parkease_zones.name}</span>
                                    )}
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
