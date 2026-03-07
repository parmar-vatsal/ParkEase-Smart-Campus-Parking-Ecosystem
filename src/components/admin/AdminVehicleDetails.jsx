import React from 'react'
import { Bike, CarFront, Phone, Mail, Hash, Building, CheckCircle, Ban, Clock, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'

export default function AdminVehicleDetails({
    selectedVehicle, setSelectedVehicle, vehicleHistory, formatDuration, updateVehicleStatus, grantEmergencyPass
}) {
    return (
        <div className="glass-card animate-fade-in-up" style={{ padding: 24 }}>
            <button onClick={() => setSelectedVehicle(null)} className="btn btn-ghost" style={{ marginBottom: 16, padding: '6px 12px', fontSize: '0.75rem' }}>
                ← Back to results
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBottom: 20 }}>
                <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>Vehicle Details</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        {selectedVehicle.vehicle_type === 'two_wheeler' ? <Bike size={22} color="#818cf8" /> : <CarFront size={22} color="#f59e0b" />}
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.05em' }}>{selectedVehicle.vehicle_number}</div>
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{selectedVehicle.brand} {selectedVehicle.model}{selectedVehicle.color ? ` • ${selectedVehicle.color}` : ''}</div>
                        </div>
                    </div>
                    <span className={`badge ${selectedVehicle.status === 'active' ? 'badge-success' : selectedVehicle.status === 'pending_approval' ? 'badge-warning' : 'badge-danger'}`}>
                        {selectedVehicle.status === 'pending_approval' ? 'Pending Approval' : selectedVehicle.status}
                    </span>
                </div>

                {selectedVehicle.parkease_profiles && (
                    <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.03)' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>Owner Details</div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 6 }}>{selectedVehicle.parkease_profiles.full_name}</div>
                        <span className="badge badge-info" style={{ fontSize: '0.6rem', marginBottom: 10, display: 'inline-block' }}>{selectedVehicle.parkease_profiles.role}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: '0.78rem', color: '#94a3b8', marginBottom: 16 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Phone size={12} /> {selectedVehicle.parkease_profiles.phone}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Mail size={12} /> {selectedVehicle.parkease_profiles.email}</span>
                            {selectedVehicle.parkease_profiles.enrollment_id && <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Hash size={12} /> {selectedVehicle.parkease_profiles.enrollment_id}</span>}
                            {selectedVehicle.parkease_profiles.department && <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Building size={12} /> {selectedVehicle.parkease_profiles.department}</span>}
                        </div>

                        {/* Emergency Pass Action */}
                        {(() => {
                            const hasPass = selectedVehicle.parkease_profiles.emergency_vehicle_until && new Date(selectedVehicle.parkease_profiles.emergency_vehicle_until) > new Date()
                            if (hasPass) {
                                return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(16,185,129,0.1)', padding: '6px 10px', borderRadius: 6 }}>
                                        <CheckCircle size={14} /> 24h Pass Active
                                    </div>
                                )
                            }
                            // Only show button for students (or roles that need vehicles)
                            return (
                                <button onClick={() => grantEmergencyPass(selectedVehicle.parkease_profiles.id)} className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '6px 12px', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                                    + Grant 24h 3rd Vehicle Pass
                                </button>
                            )
                        })()}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {selectedVehicle.status === 'pending_approval' && (
                    <button onClick={() => updateVehicleStatus(selectedVehicle.id, 'active')} className="btn btn-success" style={{ fontSize: '0.8rem' }}>
                        <CheckCircle size={14} /> Approve
                    </button>
                )}
                {selectedVehicle.status !== 'blocked' && (
                    <button onClick={() => updateVehicleStatus(selectedVehicle.id, 'blocked')} className="btn btn-danger" style={{ fontSize: '0.8rem' }}>
                        <Ban size={14} /> Block
                    </button>
                )}
                {selectedVehicle.status === 'blocked' && (
                    <button onClick={() => updateVehicleStatus(selectedVehicle.id, 'active')} className="btn btn-success" style={{ fontSize: '0.8rem' }}>
                        <CheckCircle size={14} /> Unblock
                    </button>
                )}
            </div>

            {/* History */}
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} color="#818cf8" /> Parking History
            </h4>
            {vehicleHistory.length === 0 ? (
                <p style={{ color: '#475569', fontSize: '0.8rem' }}>No parking records found</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {vehicleHistory.map(log => (
                        <div key={log.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', fontSize: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {log.status === 'inside' ? <ArrowDownCircle size={13} color="#10b981" /> : <ArrowUpCircle size={13} color="#818cf8" />}
                                <span style={{ fontWeight: 600 }}>{new Date(log.entry_time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                                <span style={{ color: '#64748b' }}>{new Date(log.entry_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}{log.exit_time && ` → ${new Date(log.exit_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {log.parkease_zones?.name && <span style={{ color: '#64748b', fontSize: '0.7rem' }}>{log.parkease_zones.name}</span>}
                                <span className={`badge ${log.status === 'inside' ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '0.6rem' }}>
                                    {log.status === 'inside' ? 'Inside' : formatDuration(log.duration_minutes)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
