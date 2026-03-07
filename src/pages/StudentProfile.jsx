import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Camera, Save, Phone, Building, Loader2, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function StudentProfile() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const [profile, setProfile] = useState({
        full_name: '',
        phone: '',
        department: '',
        semester: '',
        profile_photo: ''
    })
    const [newPhoto, setNewPhoto] = useState(null)
    const [newPhotoPreview, setNewPhotoPreview] = useState(null)

    useEffect(() => {
        fetchProfile()
    }, [])

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                navigate('/login')
                return
            }

            const { data, error } = await supabase
                .from('parkease_profiles')
                .select('*')
                .eq('id', user.id)
                .single()

            if (error) throw error
            if (data) {
                setProfile({
                    full_name: data.full_name || '',
                    phone: data.phone || '',
                    department: data.department || '',
                    semester: data.semester || '',
                    profile_photo: data.profile_photo || ''
                })
            }
        } catch (err) {
            console.error('Error fetching profile:', err)
            setError('Failed to load profile data.')
        } finally {
            setLoading(false)
        }
    }

    const handlePhotoChange = (e) => {
        const file = e.target.files[0]
        if (!file) return

        // Basic validation
        if (!file.type.startsWith('image/')) {
            setError('Please select a valid image file.')
            return
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            setError('Image must be less than 5MB.')
            return
        }

        setNewPhoto(file)
        setNewPhotoPreview(URL.createObjectURL(file))
        setError('')
        setSuccess('')
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setSaving(true)
        setError('')
        setSuccess('')

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("Not authenticated")

            let photoUrl = profile.profile_photo

            // Upload new photo if selected
            if (newPhoto) {
                const fileExt = newPhoto.name.split('.').pop()
                const fileName = `${user.id}_${Date.now()}.${fileExt}`

                const { error: uploadError } = await supabase.storage
                    .from('avatars') // Ensure this bucket exists and is public
                    .upload(fileName, newPhoto, { upsert: true })

                if (uploadError) {
                    throw new Error(`Photo upload failed: ${uploadError.message}`)
                }

                const { data: publicUrlData } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(fileName)

                photoUrl = publicUrlData.publicUrl
            }

            // Update profile record
            const { error: updateError } = await supabase
                .from('parkease_profiles')
                .update({
                    full_name: profile.full_name,
                    phone: profile.phone,
                    department: profile.department,
                    semester: profile.semester,
                    profile_photo: photoUrl
                })
                .eq('id', user.id)

            if (updateError) throw updateError

            setSuccess('Profile updated successfully!')
            setProfile(prev => ({ ...prev, profile_photo: photoUrl }))
            setNewPhoto(null) // Clear pending photo

            // Clean up preview URL
            if (newPhotoPreview) {
                URL.revokeObjectURL(newPhotoPreview)
                setNewPhotoPreview(null)
            }

        } catch (err) {
            console.error('Save error:', err)
            setError(err.message || 'Failed to update profile.')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Loader2 className="spinner" size={32} color="#818cf8" />
            </div>
        )
    }

    return (
        <div className="container">
            <button onClick={() => navigate('/dashboard')} className="btn btn-ghost" style={{ marginBottom: 20 }}>
                <ArrowLeft size={18} /> Back to Dashboard
            </button>

            <div className="glass-card animate-fade-in-up" style={{ maxWidth: 600, margin: '0 auto', padding: 30 }}>
                <div style={{ textAlign: 'center', marginBottom: 30 }}>
                    <div style={{
                        width: 120, height: 120, borderRadius: '50%', margin: '0 auto 16px',
                        background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative', overflow: 'hidden', border: '2px solid rgba(129, 140, 248, 0.3)'
                    }}>
                        {(newPhotoPreview || profile.profile_photo) ? (
                            <img
                                src={newPhotoPreview || profile.profile_photo}
                                alt="Profile"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        ) : (
                            <User size={48} color="#64748b" />
                        )}

                        {/* Custom file upload overlay */}
                        <label style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            background: 'rgba(0,0,0,0.6)', padding: '6px 0',
                            cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center'
                        }}>
                            <Camera size={16} color="white" />
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoChange}
                                style={{ display: 'none' }}
                            />
                        </label>
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Edit Profile</h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Update your personal information and photo</p>
                </div>

                {error && <div className="alert alert-danger" style={{ marginBottom: 20 }}>{error}</div>}
                {success && <div className="alert alert-success" style={{ marginBottom: 20 }}>{success}</div>}

                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div className="input-group">
                        <label className="label">Full Name</label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                            <input
                                type="text"
                                className="input"
                                style={{ paddingLeft: 44 }}
                                value={profile.full_name}
                                onChange={e => setProfile({ ...profile, full_name: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label className="label">Phone Number</label>
                        <div style={{ position: 'relative' }}>
                            <Phone size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                            <input
                                type="tel"
                                className="input"
                                style={{ paddingLeft: 44 }}
                                value={profile.phone}
                                onChange={e => setProfile({ ...profile, phone: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="input-group">
                            <label className="label">Department</label>
                            <div style={{ position: 'relative' }}>
                                <Building size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                <input
                                    type="text"
                                    className="input"
                                    style={{ paddingLeft: 44 }}
                                    value={profile.department}
                                    placeholder="e.g. Computer Science"
                                    onChange={e => setProfile({ ...profile, department: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="label">Semester</label>
                            <input
                                type="text"
                                className="input"
                                value={profile.semester}
                                placeholder="e.g. 6th"
                                onChange={e => setProfile({ ...profile, semester: e.target.value })}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
                        disabled={saving}
                    >
                        {saving ? (
                            <><Loader2 size={18} className="spinner" /> Saving Changes...</>
                        ) : (
                            <><Save size={18} /> Save Profile</>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
