import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ParkingCircle, Lock, ArrowRight, Eye, EyeOff, CheckCircle, ShieldAlert } from 'lucide-react'

export default function ResetPassword() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState(null)
    const navigate = useNavigate()

    useEffect(() => {
        // When coming from the email link, Supabase adds a session to the URL hash
        // The AuthContext automatically grabs it via getSession() / onAuthStateChange
        // So they should be "logged in" by the time they hit this page.
        // We just need to check if there's an error in the URL (e.g. expired link)
        const hash = window.location.hash
        if (hash && hash.includes('error_description')) {
            const errorDesc = new URLSearchParams(hash.substring(1)).get('error_description')
            setMessage({ type: 'error', text: decodeURIComponent(errorDesc).replace(/\+/g, ' ') })
        }
    }, [])

    const handleUpdate = async (e) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match.' })
            setLoading(false)
            return
        }

        if (password.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters long.' })
            setLoading(false)
            return
        }

        try {
            const { error } = await supabase.auth.updateUser({ password })

            if (error) {
                setMessage({ type: 'error', text: error.message })
            } else {
                setMessage({ type: 'success', text: 'Password updated successfully! You can now access your dashboard or login with your new password.' })
                setTimeout(() => {
                    navigate('/dashboard')
                }, 3000)
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
                        Create New Password
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                        Please enter a strong new password for your account.
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleUpdate} className="glass-card" style={{ padding: '32px 28px' }}>
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
                            <div style={{ marginBottom: 20 }}>
                                <label className="label">New Password</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className="input"
                                        style={{ paddingLeft: 40, paddingRight: 44 }}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                            background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
                                        }}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div style={{ marginBottom: 28 }}>
                                <label className="label">Confirm New Password</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className="input"
                                        style={{ paddingLeft: 40, paddingRight: 44 }}
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
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
                                {loading ? <div className="spinner" /> : <>Update Password <ArrowRight size={16} /></>}
                            </button>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', marginTop: 10 }}>
                            <Link to="/dashboard" className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                                Go to Dashboard
                            </Link>
                        </div>
                    )}
                </form>

            </div>
        </div>
    )
}
