import React from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Ticket, Clock, Ban } from 'lucide-react'

export default function AdminGuestPassTab({
    adminPassForm, setAdminPassForm, handleCreateAdminPass, adminPassLoading, adminPassMsg,
    allGuests, downloadQR, handleCancelPass, handleExtendTime
}) {
    return (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
            {/* Create Pass Form */}
            <div className="glass-card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <div style={{ padding: 10, background: 'rgba(99,102,241,0.1)', borderRadius: 12 }}>
                        <Ticket size={24} color="#6366f1" />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Create Event/Guest Pass</h2>
                        <p style={{ color: '#64748b', fontSize: '0.8rem' }}>Generate a QR pass for VIPs or event attendees</p>
                    </div>
                </div>

                {adminPassMsg && (
                    <div style={{
                        padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.8rem',
                        background: adminPassMsg.type === 'error' ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)',
                        color: adminPassMsg.type === 'error' ? '#f43f5e' : '#10b981',
                        border: `1px solid ${adminPassMsg.type === 'error' ? 'rgba(244,63,94,0.2)' : 'rgba(16,185,129,0.2)'}`
                    }}>
                        {adminPassMsg.text}
                    </div>
                )}

                <form onSubmit={handleCreateAdminPass} style={{ display: 'grid', gap: 16 }}>
                    <div>
                        <label className="label">Guest/VIP Name</label>
                        <input
                            className="input" placeholder="e.g. Dr. Sharma" required
                            value={adminPassForm.guest_name} onChange={e => setAdminPassForm({ ...adminPassForm, guest_name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="label">Vehicle Number</label>
                        <input
                            className="input" placeholder="e.g. GJ05AB1234" required
                            value={adminPassForm.vehicle_number} onChange={e => setAdminPassForm({ ...adminPassForm, vehicle_number: e.target.value })}
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label className="label">Vehicle Type</label>
                            <select
                                className="select" value={adminPassForm.vehicle_type}
                                onChange={e => setAdminPassForm({ ...adminPassForm, vehicle_type: e.target.value })}
                            >
                                <option value="four_wheeler">4 Wheeler (Car)</option>
                                <option value="two_wheeler">2 Wheeler (Bike)</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Valid Duration (Hours)</label>
                            <select
                                className="select" value={adminPassForm.duration_hours}
                                onChange={e => setAdminPassForm({ ...adminPassForm, duration_hours: e.target.value })}
                            >
                                <option value="4">4 Hours (Half Day)</option>
                                <option value="8">8 Hours (Full Day)</option>
                                <option value="24">24 Hours (Overnight)</option>
                                <option value="48">48 Hours (2 Days)</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="label">Purpose</label>
                        <select
                            className="select" value={adminPassForm.purpose}
                            onChange={e => setAdminPassForm({ ...adminPassForm, purpose: e.target.value })}
                        >
                            <option value="Event/Function">Event/Function</option>
                            <option value="VIP Visit">VIP Visit</option>
                            <option value="Vendor/Maintenance">Vendor/Maintenance</option>
                            <option value="Official Meeting">Official Meeting</option>
                        </select>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={adminPassLoading} style={{ marginTop: 8 }}>
                        {adminPassLoading ? <div className="spinner" /> : 'Generate Guest Pass & QR'}
                    </button>
                </form>
            </div>

            {/* Guest Pass Activity List */}
            <div className="glass-card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 14 }}>
                    Guest Parking Activity
                </h3>
                {allGuests.length === 0 ? (
                    <p style={{ color: '#475569', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>No guest passes found.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {allGuests.map(pass => {
                            const isExpired = new Date() > new Date(pass.valid_until)
                            const status = pass.status === 'cancelled' ? 'cancelled' :
                                pass.status === 'exited' ? 'exited' :
                                    pass.status === 'active' ? (isExpired ? 'overstayed' : 'active') :
                                        (isExpired ? 'expired' : 'pending')

                            const colorMap = {
                                cancelled: 'badge-danger', exited: 'badge-info',
                                active: 'badge-success', overstayed: 'badge-danger',
                                expired: 'badge-warning', pending: 'badge-warning'
                            }

                            return (
                                <div key={pass.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', fontSize: '0.8rem', flexWrap: 'wrap', gap: 10 }}>
                                    <div style={{ flex: 1, minWidth: 200 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                            <Ticket size={14} color="#818cf8" />
                                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{pass.guest_name}</span>
                                            {pass.purpose.includes('Event') && (
                                                <span className="badge badge-info" style={{ fontSize: '0.62rem', background: 'rgba(99,102,241,0.2)' }}>★ EVENT</span>
                                            )}
                                            <span className={`badge ${colorMap[status]}`} style={{ fontSize: '0.62rem' }}>
                                                {status.toUpperCase()}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: '#94a3b8' }}>
                                            <span><strong>Vehicle:</strong> {pass.vehicle_number}</span>
                                            <span><strong>Sponsor:</strong> {pass.parkease_profiles?.full_name}</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 150 }}>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 4 }}>
                                            Valid until: {new Date(pass.valid_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <div style={{ display: 'none' }}>
                                                <QRCodeSVG id={`admin-qr-${pass.id}`} value={pass.qr_code_token} size={240} level="H" includeMargin={false} fgColor="#1e293b" bgColor="#ffffff" />
                                            </div>
                                            <button onClick={() => downloadQR(pass)} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.7rem' }} title="Download QR">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                            </button>
                                            {pass.status !== 'cancelled' && pass.status !== 'exited' && (
                                                <button onClick={() => handleCancelPass(pass.id)} className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.7rem' }}>
                                                    <Ban size={12} /> Cancel
                                                </button>
                                            )}
                                            {pass.status !== 'cancelled' && (
                                                <button onClick={() => handleExtendTime(pass.id, pass.valid_until)} className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.7rem' }}>
                                                    <Clock size={12} /> Extend (+2h)
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
