import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { QRCodeSVG } from 'qrcode.react'
import { Car, Download, Bike, CarFront, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react'

export default function MyVehicles() {
    const { profile } = useAuth()
    const [vehicles, setVehicles] = useState([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [deleteError, setDeleteError] = useState('')

    // 90-day deletion cooldown derived from profile
    const daysSinceDelete = profile?.last_vehicle_deleted_at
        ? Math.floor((new Date() - new Date(profile.last_vehicle_deleted_at)) / (1000 * 60 * 60 * 24))
        : 999
    const isUnderDeleteCooldown = daysSinceDelete < 90
    const deleteDaysRemaining = Math.max(0, 90 - daysSinceDelete)

    useEffect(() => {
        fetchVehicles()
    }, [])

    const fetchVehicles = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('parkease_vehicles')
                .select('*')
                .eq('owner_id', profile.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setVehicles(data || [])
        } catch (error) {
            console.error('Error fetching vehicles:', error)
        } finally {
            setLoading(false)
        }
    }


    const downloadQR = (userName, userId) => {
        const svg = document.getElementById(`qr-${userId}`)
        if (!svg) return

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const data = new XMLSerializer().serializeToString(svg)
        const img = new Image()
        const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' })
        const url = URL.createObjectURL(svgBlob)

        img.onload = () => {
            canvas.width = 300
            canvas.height = 360
            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 30, 20, 240, 240)
            ctx.fillStyle = '#1e293b'
            ctx.font = 'bold 18px Inter, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(userName, 150, 290)
            ctx.font = '12px Inter, sans-serif'
            ctx.fillStyle = '#64748b'
            ctx.fillText('ParkEase Smart Parking', 150, 315)
            ctx.fillText('Scan at campus gate', 150, 335)

            const link = document.createElement('a')
            link.download = `ParkEase_QR_${userName.replace(/\s+/g, '_')}.png`
            link.href = canvas.toDataURL('image/png')
            link.click()
            URL.revokeObjectURL(url)
        }
        img.src = url
    }

    const statusConfig = {
        active: { color: '#10b981', bg: 'badge-success', icon: CheckCircle, label: 'Active' },
        pending_approval: { color: '#f59e0b', bg: 'badge-warning', icon: Clock, label: 'Pending' },
        rejected: { color: '#f43f5e', bg: 'badge-danger', icon: XCircle, label: 'Rejected' },
        blocked: { color: '#f43f5e', bg: 'badge-danger', icon: XCircle, label: 'Blocked' },
    }

    const handleDelete = async (id) => {
        if (isUnderDeleteCooldown) {
            setDeleteError(`You already deleted a vehicle ${daysSinceDelete} day(s) ago. You cannot delete another vehicle for ${deleteDaysRemaining} more day${deleteDaysRemaining !== 1 ? 's' : ''} (90-day policy).`)
            return
        }

        if (!confirm('Are you sure you want to delete this vehicle? This will start a 90-day cooldown on deleting any other vehicle.')) return

        setActionLoading(true)
        setDeleteError('')

        const { data: delData, error: delErr } = await supabase.from('parkease_vehicles').delete().eq('id', id).select()

        if (delErr) {
            console.error('Delete error', delErr)
            setDeleteError('Failed to delete vehicle: ' + delErr.message)
        } else if (!delData || delData.length === 0) {
            setDeleteError('Cannot delete: This vehicle may be linked to an active parking session. Please exit first.')
        } else {
            // Start the 90-day deletion cooldown
            await supabase.from('parkease_profiles').update({ last_vehicle_deleted_at: new Date().toISOString() }).eq('id', profile.id)
            setVehicles(vehicles.filter(v => v.id !== id))
            window.location.reload()
        }

        setActionLoading(false)
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}>
                <div className="spinner" style={{ width: 32, height: 32 }} />
            </div>
        )
    }

    return (
        <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 6 }}>My Vehicles</h1>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: 24 }}>
                {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} registered
            </p>

            {/* 90-Day Deletion Cooldown Banner */}
            {isUnderDeleteCooldown && (
                <div style={{
                    padding: '14px 20px', borderRadius: 14, marginBottom: 24,
                    background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#f59e0b',
                }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Clock size={16} /> 90-Day Deletion Policy Active
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#fbbf24', lineHeight: 1.6 }}>
                        You deleted a vehicle {daysSinceDelete} day(s) ago. You cannot delete another vehicle for <b>{deleteDaysRemaining} more day{deleteDaysRemaining !== 1 ? 's' : ''}</b>.
                    </div>
                </div>
            )}

            {/* General Delete Error */}
            {deleteError && (
                <div style={{
                    padding: '12px 16px', borderRadius: 12, marginBottom: 20,
                    background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)',
                    color: '#f43f5e', fontSize: '0.85rem',
                }}>
                    ❌ {deleteError}
                    <button onClick={() => setDeleteError('')} style={{ marginLeft: 12, background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                </div>
            )}

            {/* Unified Student QR Code */}
            {vehicles.some(v => v.status === 'active') && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
                    <div className="id-card-wrapper" style={{
                        position: 'relative',
                        width: '100%',
                        maxWidth: 340,
                        background: 'linear-gradient(145deg, #1e1b4b, #312e81)',
                        borderRadius: 24,
                        padding: 2,
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.2)'
                    }}>
                        <div style={{
                            background: '#0f172a',
                            borderRadius: 22,
                            padding: 24,
                            position: 'relative',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center'
                        }}>
                            {/* Decorative Background Elements */}
                            <div style={{ position: 'absolute', top: -50, right: -50, width: 150, height: 150, background: 'rgba(99, 102, 241, 0.15)', borderRadius: '50%', filter: 'blur(30px)' }} />
                            <div style={{ position: 'absolute', bottom: -50, left: -50, width: 150, height: 150, background: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%', filter: 'blur(30px)' }} />

                            {/* Header */}
                            <div style={{ marginBottom: 20, width: '100%', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 16 }}>
                                <h2 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc', letterSpacing: 1, textTransform: 'uppercase' }}>
                                    Campus Digital ID
                                </h2>
                                <p style={{ color: '#818cf8', fontSize: '0.7rem', fontWeight: 600, marginTop: 4 }}>
                                    PARKEASE SMART PARKING
                                </p>
                            </div>

                            {/* Profile Photo */}
                            <div style={{
                                width: 90, height: 90, borderRadius: '50%',
                                border: '3px solid #6366f1', padding: 3,
                                marginBottom: 16, background: 'rgba(255,255,255,0.05)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 8px 16px rgba(0,0,0,0.3)'
                            }}>
                                {profile.profile_photo ? (
                                    <img
                                        src={profile.profile_photo}
                                        alt={profile.full_name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                                    />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 800, color: '#64748b' }}>
                                        {profile.full_name?.charAt(0)}
                                    </div>
                                )}
                            </div>

                            {/* User Info */}
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.5px' }}>
                                    {profile.full_name}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{profile.enrollment_id}</span>
                                    <span>•</span>
                                    <span style={{ textTransform: 'uppercase' }}>{profile.role}</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                                    {profile.department} {profile.semester ? `(Sem ${profile.semester})` : ''}
                                </div>
                            </div>

                            {/* QR Code */}
                            <div className="qr-container" style={{
                                background: 'white', padding: 12, borderRadius: 16,
                                marginBottom: 20, boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                            }}>
                                <QRCodeSVG
                                    id={`qr-${profile.id}`}
                                    value={profile.id}
                                    size={160}
                                    level="H"
                                    includeMargin={false}
                                    fgColor="#0f172a"
                                    bgColor="#ffffff"
                                />
                            </div>

                            {/* Footer */}
                            <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                                Valid for {vehicles.filter(v => v.status === 'active').length} Active Vehicle(s)
                            </div>
                        </div>

                        {/* Download Button overlayed */}
                        <button
                            className="btn btn-primary"
                            onClick={() => downloadQR(profile.full_name, profile.id)}
                            style={{ position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)', padding: '10px 24px', borderRadius: 24, boxShadow: '0 8px 16px rgba(99, 102, 241, 0.4)' }}
                        >
                            <Download size={16} /> Save ID
                        </button>
                    </div>
                </div>
            )}

            {vehicles.length === 0 ? (
                <div className="glass-card" style={{
                    padding: 48, textAlign: 'center', display: 'flex',
                    flexDirection: 'column', alignItems: 'center'
                }}>
                    <Car size={48} color="#334155" style={{ marginBottom: 16 }} />
                    <p style={{ color: '#64748b', marginBottom: 4 }}>No vehicles registered yet</p>
                    <p style={{ color: '#475569', fontSize: '0.8rem' }}>Register your vehicle to get a QR code</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                    {vehicles.map((vehicle, idx) => {
                        const status = statusConfig[vehicle.status] || statusConfig.active
                        const TypeIcon = vehicle.vehicle_type === 'two_wheeler' ? Bike : CarFront

                        return (
                            <div
                                key={vehicle.id}
                                className="glass-card glass-card-hover animate-fade-in-up"
                                style={{ padding: 24, animationDelay: `${idx * 0.1}s` }}
                            >
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 10,
                                            background: vehicle.vehicle_type === 'two_wheeler'
                                                ? 'rgba(99, 102, 241, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <TypeIcon size={20} color={vehicle.vehicle_type === 'two_wheeler' ? '#818cf8' : '#f59e0b'} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '0.05em' }}>
                                                {vehicle.vehicle_number}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                {vehicle.brand} {vehicle.model}
                                                {vehicle.color && ` • ${vehicle.color}`}
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`badge ${status.bg}`}>
                                        <status.icon size={10} /> {status.label}
                                    </span>
                                </div>

                                {/* Details instead of QR Code */}
                                {vehicle.status === 'active' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, color: '#10b981', fontSize: '0.8rem', fontWeight: 600 }}>
                                        <CheckCircle size={14} /> Linked to your ID QR
                                    </div>
                                )}

                                <div style={{ fontSize: '0.7rem', color: '#475569', textAlign: 'center' }}>
                                    Registered: {new Date(vehicle.created_at).toLocaleDateString('en-IN')}
                                </div>

                                {/* Management Actions */}
                                <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <button
                                        className="btn btn-ghost"
                                        style={{
                                            flex: 1, fontSize: '0.75rem', padding: '8px 0',
                                            color: isUnderDeleteCooldown ? '#64748b' : '#f43f5e',
                                            background: isUnderDeleteCooldown ? 'rgba(100,116,139,0.08)' : 'rgba(244,63,94,0.1)',
                                            cursor: isUnderDeleteCooldown ? 'not-allowed' : 'pointer',
                                        }}
                                        onClick={() => handleDelete(vehicle.id)}
                                        disabled={actionLoading || isUnderDeleteCooldown}
                                        title={isUnderDeleteCooldown ? `90-day deletion cooldown active (${deleteDaysRemaining} days left)` : 'Remove this vehicle'}
                                    >
                                        <Trash2 size={14} style={{ marginRight: 6 }} />
                                        {isUnderDeleteCooldown ? `Locked for ${deleteDaysRemaining}d` : 'Remove Vehicle'}
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
