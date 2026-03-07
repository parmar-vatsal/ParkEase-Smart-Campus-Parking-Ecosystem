import React from 'react'
import { AlertTriangle, User, Check, X } from 'lucide-react'

export default function PendingWalkins({ pendingWalkins, handleApproveWalkIn, handleRejectWalkIn }) {
    if (!pendingWalkins || pendingWalkins.length === 0) {
        return (
            <div className="glass-card" style={{ padding: 20, marginTop: 20, borderLeft: '3px solid #f59e0b' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b' }}>
                    <AlertTriangle size={16} />
                    Pending Walk-ins
                </h3>
                <p style={{ color: '#475569', fontSize: '0.8rem', textAlign: 'center', padding: 10 }}>No walk-ins waiting.</p>
            </div>
        )
    }

    return (
        <div className="glass-card" style={{ padding: 20, marginTop: 20, borderLeft: '3px solid #f59e0b' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b' }}>
                <AlertTriangle size={16} />
                Pending Walk-ins
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pendingWalkins.map(walkin => (
                    <div key={walkin.id} style={{
                        padding: '12px 14px', borderRadius: 10, background: 'rgba(255,168,0,0.05)',
                        border: '1px solid rgba(245,158,11,0.2)',
                        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between'
                    }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <User size={14} color="#94a3b8" />
                                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{walkin.guest_name}</span>
                                <span className="badge badge-warning" style={{ fontSize: '0.6rem' }}>WAITING</span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'flex', gap: 12 }}>
                                <span>🚗 {walkin.vehicle_number}</span>
                                <span>📞 {walkin.guest_phone || 'N/A'}</span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>
                                Purpose: {walkin.purpose} • Requested {Math.floor((new Date() - new Date(walkin.created_at)) / 60000)} mins ago
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => handleApproveWalkIn(walkin)} className="btn btn-success" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                                <Check size={14} /> Approve & Enter
                            </button>
                            <button onClick={() => handleRejectWalkIn(walkin.id)} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                                <X size={14} /> Reject
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
