import React from 'react'
import { Bell, User, ArrowUpCircle } from 'lucide-react'

export default function OverstayPanel({ overstayGuests, setManualSearch, processGuest, setSearchLoading }) {
    if (!overstayGuests || overstayGuests.length === 0) return null

    return (
        <div className="glass-card" style={{ padding: 20, marginTop: 20, borderLeft: '3px solid #f43f5e', animation: 'pulse 2s infinite' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#f43f5e' }}>
                <Bell size={16} />
                Overstay Alert — Time Expired
                <span style={{ marginLeft: 'auto', background: '#f43f5e', color: 'white', borderRadius: 99, fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px' }}>
                    {overstayGuests.length}
                </span>
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 12 }}>
                These visitors have not checked out past their allowed time. Click "Process Exit" to check them out using their OTP.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {overstayGuests.map(guest => {
                    const now = new Date()
                    const expiry = new Date(guest.valid_until)
                    const overMins = Math.round((now - expiry) / 60000)
                    const overStr = overMins >= 60 ? `${Math.floor(overMins / 60)}h ${overMins % 60}m` : `${overMins}m`
                    return (
                        <div key={guest.id} style={{
                            padding: '12px 14px', borderRadius: 10,
                            background: 'rgba(244, 63, 94, 0.07)',
                            border: '1px solid rgba(244, 63, 94, 0.25)',
                            display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between'
                        }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <User size={14} color="#fca5a5" />
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fca5a5' }}>{guest.guest_name}</span>
                                    <span className="badge badge-danger" style={{ fontSize: '0.6rem' }}>OVERSTAYING</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'flex', gap: 12 }}>
                                    <span>🚗 {guest.vehicle_number}</span>
                                    <span>⏰ Expired {overStr} ago</span>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>
                                    Valid till: {new Date(guest.valid_until).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} • OTP: <strong style={{ color: '#f87171' }}>{guest.otp_code}</strong>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setManualSearch(guest.otp_code)
                                    processGuest(guest.otp_code, 'manual_entry')
                                    setSearchLoading(true)
                                }}
                                className="btn btn-danger"
                                style={{ padding: '6px 14px', fontSize: '0.75rem' }}
                            >
                                <ArrowUpCircle size={14} /> Process Exit
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
