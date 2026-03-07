import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ParkingCircle, Mail, ArrowRight, CheckCircle, ShieldAlert } from 'lucide-react'

export default function ForgotPassword() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState(null) // { type: 'success' | 'error', text: string }

    const handleReset = async (e) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            })

            if (error) {
                setMessage({ type: 'error', text: error.message })
            } else {
                setMessage({ type: 'success', text: `Check your email! A password reset link has been sent to ${email}.` })
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'An unexpected error occurred.' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, position: 'relative',
        }}>
            <div className="animated-bg" />

            <div style={{ width: '100%', maxWidth: 420 }} className="animate-fade-in-up">
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: 18, margin: '0 auto 16px',
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 30px rgba(99, 102, 241, 0.3)',
                    }}>
                        <ParkingCircle size={32} color="white" />
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 6 }}>
                        Reset Password
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                        Enter your email address to receive a secure password reset link.
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleReset} className="glass-card" style={{ padding: '32px 28px' }}>
                    {message && (
                        <div style={{
                            padding: '12px 16px', borderRadius: 10, marginBottom: 20,
                            background: message.type === 'error' ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            border: `1px solid ${message.type === 'error' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                            color: message.type === 'error' ? '#f43f5e' : '#10b981',
                            fontSize: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: 10, lineHeight: 1.4
                        }}>
                            {message.type === 'error' ? <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 2 }} /> : <CheckCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />}
                            <div>{message.text}</div>
                        </div>
                    )}

                    {!message || message.type === 'error' ? (
                        <>
                            <div style={{ marginBottom: 24 }}>
                                <label className="label">Email Address</label>
                                <div style={{ position: 'relative' }}>
                                    <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                    <input
                                        type="email"
                                        className="input"
                                        style={{ paddingLeft: 40 }}
                                        placeholder="you@scet.ac.in"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary btn-lg"
                                style={{ width: '100%' }}
                                disabled={loading}
                            >
                                {loading ? <div className="spinner" /> : <>Send Reset Link <ArrowRight size={16} /></>}
                            </button>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center' }}>
                            <Link to="/login" className="btn btn-ghost btn-lg" style={{ width: '100%' }}>
                                Return to Login
                            </Link>
                        </div>
                    )}
                </form>

                <p style={{ textAlign: 'center', marginTop: 24, color: '#64748b', fontSize: '0.85rem' }}>
                    Remembered your password?{' '}
                    <Link to="/login" style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}>
                        Login here
                    </Link>
                </p>
            </div>
        </div>
    )
}
