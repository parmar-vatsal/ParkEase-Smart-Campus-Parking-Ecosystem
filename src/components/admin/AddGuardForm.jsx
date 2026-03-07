import React from 'react'
import { UserPlus, User, Mail, Phone, Lock } from 'lucide-react'

export default function AddGuardForm({ guardForm, setGuardForm, handleCreateGuard, guardLoading, guardMessage }) {
    return (
        <div className="animate-fade-in">
            <div className="glass-card" style={{ padding: '32px 28px', maxWidth: 480, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UserPlus size={26} color="#818cf8" />
                    </div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 6 }}>Add Security Guard</h2>
                    <p style={{ color: '#64748b', fontSize: '0.8rem' }}>Create a login account for a new campus guard. They can use the Guard Scanner after logging in.</p>
                </div>

                {/* Message */}
                {guardMessage && (
                    <div style={{
                        padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: '0.8rem',
                        background: guardMessage.type === 'error' ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)',
                        border: `1px solid ${guardMessage.type === 'error' ? 'rgba(244,63,94,0.25)' : 'rgba(16,185,129,0.25)'}`,
                        color: guardMessage.type === 'error' ? '#f43f5e' : '#10b981',
                    }}>
                        {guardMessage.text}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleCreateGuard}>
                    {/* Full Name */}
                    <div style={{ marginBottom: 16 }}>
                        <label className="label">Full Name</label>
                        <div style={{ position: 'relative' }}>
                            <User size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                            <input
                                className="input" style={{ paddingLeft: 38 }}
                                placeholder="Ramesh Singh"
                                value={guardForm.fullName}
                                onChange={(e) => setGuardForm({ ...guardForm, fullName: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div style={{ marginBottom: 16 }}>
                        <label className="label">Email Address</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                            <input
                                type="email"
                                className="input" style={{ paddingLeft: 38 }}
                                placeholder="guard@scet.ac.in"
                                value={guardForm.email}
                                onChange={(e) => setGuardForm({ ...guardForm, email: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    {/* Phone */}
                    <div style={{ marginBottom: 16 }}>
                        <label className="label">Phone Number</label>
                        <div style={{ position: 'relative' }}>
                            <Phone size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                            <input
                                type="tel"
                                className="input" style={{ paddingLeft: 38 }}
                                placeholder="9876543210"
                                value={guardForm.phone}
                                onChange={(e) => setGuardForm({ ...guardForm, phone: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div style={{ marginBottom: 24 }}>
                        <label className="label">Temporary Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                            <input
                                type="password"
                                className="input" style={{ paddingLeft: 38 }}
                                placeholder="Min 6 characters"
                                value={guardForm.password}
                                onChange={(e) => setGuardForm({ ...guardForm, password: e.target.value })}
                                required minLength={6}
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px 0' }} disabled={guardLoading}>
                        {guardLoading ? <div className="spinner" /> : <><UserPlus size={18} /> Create Guard Account</>}
                    </button>
                </form>
            </div>
        </div>
    )
}
