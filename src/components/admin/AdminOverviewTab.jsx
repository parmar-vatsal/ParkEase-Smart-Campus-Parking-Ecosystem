import React from 'react'
import { Car, MapPin, ArrowDownCircle, ArrowUpCircle, Users, Clock, AlertTriangle, ChevronRight, AlertCircle } from 'lucide-react'
import { getCapacityColor, formatDuration } from '../../utils/format'

export default function AdminOverviewTab({ stats, setActiveTab, capacityLoading, capacity, overstayLogs }) {
    return (
        <div className="animate-fade-in">
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                    { label: 'Registered', value: stats.totalVehicles, color: '#818cf8', icon: Car },
                    { label: 'Inside Now', value: stats.currentlyInside, color: '#10b981', icon: MapPin },
                    { label: 'Today In', value: stats.todayEntries, color: '#f59e0b', icon: ArrowDownCircle },
                    { label: 'Today Out', value: stats.todayExits, color: '#a78bfa', icon: ArrowUpCircle },
                    { label: 'Total Users', value: stats.totalUsers, color: '#f472b6', icon: Users },
                    { label: 'Pending', value: stats.pendingApprovals, color: stats.pendingApprovals > 0 ? '#f43f5e' : '#64748b', icon: Clock },
                ].map(s => (
                    <div key={s.label} className="stat-card" style={{ cursor: 'default' }}>
                        <s.icon size={18} color={s.color} />
                        <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Pending approvals alert */}
            {stats.pendingApprovals > 0 && (
                <div
                    onClick={() => setActiveTab('vehicles')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                        borderRadius: 12, marginBottom: 20, cursor: 'pointer',
                        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                    }}
                >
                    <AlertTriangle size={24} color="#f59e0b" />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: '#fcd34d' }}>Action Required</div>
                        <div style={{ fontSize: '0.85rem', color: '#fbbf24' }}>{stats.pendingApprovals} vehicle registrations pending review</div>
                    </div>
                    <ChevronRight size={20} color="#f59e0b" />
                </div>
            )}

            {/* Live Capacity */}
            <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Live Zone Capacity</h3>
                    <button className="btn-secondary" onClick={() => setActiveTab('capacity')} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                        View Details
                    </button>
                </div>

                {capacityLoading ? (
                    <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Loading capacity...</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                        {capacity.map(zone => {
                            const pct = zone.occupancy_percent || 0
                            const color = getCapacityColor(pct)

                            return (
                                <div key={zone.zone_id + zone.vehicle_type} style={{
                                    padding: '12px 14px', borderRadius: 10,
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{zone.zone_name}</div>
                                        <div style={{ fontWeight: 800, color }}>{pct}%</div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginBottom: 6 }}>
                                        <span>{zone.vehicle_type === 'two_wheeler' ? '2-Wheeler' : '4-Wheeler'}</span>
                                        <span>{zone.available_slots} / {zone.total_slots} free</span>
                                    </div>
                                    <div className="capacity-bar">
                                        <div className="capacity-bar-fill" style={{ width: `${pct}%`, background: color }} />
                                    </div>
                                </div>
                            )
                        })}
                        {capacity.length === 0 && <div style={{ color: '#64748b', fontSize: '0.9rem', gridColumn: '1 / -1' }}>No capacity data available</div>}
                    </div>
                )}
            </div>

            {/* Overstaying Vehicles Alert */}
            {overstayLogs && overstayLogs.length > 0 && (
                <div className="glass-card" style={{ padding: 20, border: '1px solid rgba(244, 63, 94, 0.3)', background: 'linear-gradient(145deg, rgba(244,63,94,0.05) 0%, transparent 100%)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <div style={{ padding: 8, background: '#f43f5e', borderRadius: '50%', display: 'flex', alignItems: 'center' }}>
                            <AlertCircle size={18} color="white" />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fca5a5', fontWeight: 700 }}>Potential Overstays ({overstayLogs.length})</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {overstayLogs.map(log => (
                            <div key={log.id} style={{
                                padding: '10px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.2)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8
                            }}>
                                <div>
                                    <div style={{ fontWeight: 700 }}>{log.vehicle_number}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>{log.is_guest ? 'Guest Pass' : 'Registered Vehicle'}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#f43f5e', fontWeight: 600 }}>In for {formatDuration(log.duration_minutes)}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Since {new Date(log.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
