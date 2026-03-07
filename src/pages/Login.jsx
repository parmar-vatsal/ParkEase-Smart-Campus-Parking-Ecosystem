import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ParkingCircle, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email, password
            })

            if (authError) {
                setError(authError.message)
                setLoading(false)
                return
            }

            if (!data.session) {
                setError('Please check your email and confirm your account before signing in.')
                setLoading(false)
                return
            }

            // Successfully logged in! AuthContext handles setting user & profile state.
            // The useEffect will automatically redirect when profile is loaded.
        } catch (err) {
            setError('An unexpected error occurred.')
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen p-5 relative">
            <div className="animated-bg" />

            <div className="w-full max-w-md animate-fade-in-up">
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
                        Welcome back
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                        Sign in to ParkEase Smart Parking
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin} className="glass-card p-8">
                    {error && (
                        <div style={{
                            padding: '10px 14px', borderRadius: 10, marginBottom: 20,
                            background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)',
                            color: '#f43f5e', fontSize: '0.8rem',
                        }}>
                            {error}
                        </div>
                    )}

                    <div style={{ marginBottom: 20 }}>
                        <label className="label">Email Address</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                            <input
                                type="email"
                                className="input"
                                style={{ paddingLeft: 40 }}
                                placeholder="you@scet.ac.in"
                                pattern=".+@scet\.ac\.in$"
                                title="Please use your @scet.ac.in email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: 28 }}>
                        <label className="label">Password</label>
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
                        <div style={{ textAlign: 'right', marginTop: 10 }}>
                            <Link to="/forgot-password" style={{ color: '#818cf8', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
                                Forgot Password?
                            </Link>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        style={{ width: '100%' }}
                        disabled={loading}
                    >
                        {loading ? <div className="spinner" /> : <>Sign In <ArrowRight size={16} /></>}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: 24, color: '#64748b', fontSize: '0.85rem' }}>
                    Don't have an account?{' '}
                    <Link to="/register" style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}>
                        Register here
                    </Link>
                </p>
            </div>
        </div>
    )
}
