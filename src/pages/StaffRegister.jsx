import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ParkingCircle, Mail, Lock, User, Phone, Hash, Building, ArrowRight, GraduationCap, Upload, Image as ImageIcon } from 'lucide-react'

export default function StaffRegister() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [successMessage, setSuccessMessage] = useState(false)
    const [form, setForm] = useState({
        email: '', password: '', fullName: '', phone: '',
        employeeId: '', role: 'faculty', department: ''
    })
    const [photoFile, setPhotoFile] = useState(null)
    const [photoPreview, setPhotoPreview] = useState(null)

    const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

    const handlePhotoChange = (e) => {
        const file = e.target.files[0]
        if (!file) return
        if (file.size > 5 * 1024 * 1024) {
            setError('Photo must be less than 5MB')
            return
        }
        setPhotoFile(file)
        setPhotoPreview(URL.createObjectURL(file))
        setError('')
    }

    const handleRegister = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        if (!photoFile) {
            setError('Please upload a clear profile photo for security verification.')
            setLoading(false)
            return
        }

        try {
            // 1. Upload Photo to Storage
            const fileExt = photoFile.name.split('.').pop()
            const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`

            const { error: uploadError, data: uploadData } = await supabase.storage
                .from('avatars')
                .upload(fileName, photoFile)

            if (uploadError) {
                console.error('Storage error details:', uploadError)
                throw new Error('Failed to upload profile photo. Make sure the avatars bucket exists and is public.')
            }

            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)

            // 2. Sign up with Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: form.email,
                password: form.password,
                options: {
                    data: {
                        full_name: form.fullName,
                        phone: form.phone,
                        enrollment_id: form.employeeId, // we map employeeId to the same DB column
                        role: form.role,
                        department: form.department || null,
                        profile_photo: publicUrl
                    }
                }
            })

            if (authError) {
                setError(authError.message)
                setLoading(false)
                return
            }

            if (!authData?.session) {
                setSuccessMessage(true)
                setLoading(false)
                return
            }

            // Successfully registered and auto-logged in!
            setSuccessMessage(true)
            setLoading(false)
            // Redirect will be handled by AuthContext + App.jsx routing
            setTimeout(() => {
                window.location.href = '/dashboard'
            }, 1500)

        } catch (err) {
            console.error('Registration error:', err)
            let msg = err.message || 'An unexpected error occurred.'
            if (msg.includes('already registered') || msg.includes('already exists')) {
                msg = 'This email is already registered. Please login instead.'
            }
            setError(msg)
            setLoading(false)
        }
    }

    const departments = [
        'Artificial Intelligence & Data Science',
        'Applied Science and Humanities',
        'Chemical Engineering',
        'Civil Engineering',
        'Computer Engineering',
        'Electrical Engineering',
        'Electronics & Communication Engineering',
        'Information Technology',
        'Instrumentation and Control',
        'MCA',
        'Mechanical Engineering',
        'Textile Technology'
    ]

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, position: 'relative',
        }}>
            <div className="animated-bg" />

            <div style={{ width: '100%', maxWidth: 480 }} className="animate-fade-in-up">
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px',
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 30px rgba(99, 102, 241, 0.3)',
                    }}>
                        <ParkingCircle size={28} color="white" />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 6 }}>
                        Staff & Faculty Registration
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        Register for a staff parking account
                    </p>
                </div>

                {successMessage ? (
                    <div className="glass-card animate-fade-in" style={{ padding: '40px 24px', textAlign: 'center' }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
                        }}>
                            <Mail size={32} color="#10b981" />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 12, color: '#10b981' }}>
                            Registration Successful!
                        </h2>
                        <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: 24, lineHeight: 1.5 }}>
                            {form.email ? (
                                <>We've sent a confirmation email to <strong>{form.email}</strong>.<br /><br />
                                    Please check your inbox and click the link to verify your account before logging in.</>
                            ) : (
                                <>Registration successful! Redirecting you to your dashboard...</>
                            )}
                        </p>
                        <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
                            Go to Login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleRegister} className="glass-card" style={{ padding: '28px 24px' }}>
                        {error && (
                            <div style={{
                                padding: '10px 14px', borderRadius: 10, marginBottom: 16,
                                background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)',
                                color: '#f43f5e', fontSize: '0.8rem',
                            }}>
                                {error}
                            </div>
                        )}

                        {/* Profile Photo Upload */}
                        <div style={{ marginBottom: 20, textAlign: 'center' }}>
                            <label className="label" style={{ textAlign: 'left', marginBottom: 8 }}>Profile Photo (Required for Guard Verification)</label>

                            <label style={{
                                display: 'block',
                                border: '2px dashed rgba(99, 102, 241, 0.4)',
                                borderRadius: 16,
                                padding: photoPreview ? '8px' : '24px',
                                cursor: 'pointer',
                                background: 'rgba(255,255,255,0.03)',
                                transition: 'all 0.2s'
                            }}>
                                <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                                {photoPreview ? (
                                    <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto' }}>
                                        <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
                                        <div style={{ position: 'absolute', bottom: -10, right: -10, background: '#6366f1', borderRadius: '50%', padding: 6, display: 'flex' }}>
                                            <Upload size={14} color="white" />
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <ImageIcon size={24} color="#818cf8" />
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                                            <span style={{ color: '#818cf8', fontWeight: 600 }}>Click to upload</span> a clear face photo
                                        </div>
                                    </div>
                                )}
                            </label>
                        </div>

                        {/* Two column grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                            <div>
                                <label className="label">Full Name</label>
                                <div style={{ position: 'relative' }}>
                                    <User size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                    <input className="input" style={{ paddingLeft: 36, fontSize: '0.8rem' }} placeholder="Raj Patel"
                                        value={form.fullName} onChange={(e) => updateForm('fullName', e.target.value)} required />
                                </div>
                            </div>
                            <div>
                                <label className="label">Employee ID</label>
                                <div style={{ position: 'relative' }}>
                                    <Hash size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                    <input className="input" style={{ paddingLeft: 36, fontSize: '0.8rem' }} placeholder="EMP1234"
                                        value={form.employeeId} onChange={(e) => updateForm('employeeId', e.target.value)} required />
                                </div>
                            </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label className="label">Email</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                <input type="email" className="input" style={{ paddingLeft: 36, fontSize: '0.8rem' }} placeholder="you@scet.ac.in"
                                    pattern=".+@scet\.ac\.in$" title="Please use your @scet.ac.in email address"
                                    value={form.email} onChange={(e) => updateForm('email', e.target.value)} required />
                            </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label className="label">Department</label>
                            <div style={{ position: 'relative' }}>
                                <Building size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                <select className="select" style={{ paddingLeft: 36, fontSize: '0.8rem', width: '100%' }}
                                    value={form.department} onChange={(e) => updateForm('department', e.target.value)} required>
                                    <option value="" disabled>Select your department</option>
                                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                            <div>
                                <label className="label">Phone</label>
                                <div style={{ position: 'relative' }}>
                                    <Phone size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                    <input className="input" style={{ paddingLeft: 36, fontSize: '0.8rem' }} placeholder="+91-9876543210"
                                        value={form.phone} onChange={(e) => updateForm('phone', e.target.value)} required />
                                </div>
                            </div>
                            <div>
                                <label className="label">Password</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                    <input type="password" className="input" style={{ paddingLeft: 36, fontSize: '0.8rem' }} placeholder="Min 6 chars"
                                        value={form.password} onChange={(e) => updateForm('password', e.target.value)} required minLength={6} />
                                </div>
                            </div>
                        </div>

                        <div style={{ marginBottom: 24 }}>
                            <label className="label">Role</label>
                            <select className="select" style={{ fontSize: '0.8rem', width: '100%' }}
                                value={form.role} onChange={(e) => updateForm('role', e.target.value)} required>
                                <option value="faculty">Faculty</option>
                                <option value="staff">Staff</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            style={{ width: '100%' }}
                            disabled={loading}
                        >
                            {loading ? <div className="spinner" /> : <>Create Account <ArrowRight size={16} /></>}
                        </button>
                    </form>
                )}

                <div style={{ textAlign: 'center', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                        Already have an account?{' '}
                        <Link to="/login" style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}>
                            Sign in
                        </Link>
                    </p>
                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                        Forgot your password?{' '}
                        <Link to="/forgot-password" style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}>
                            Reset it here
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
