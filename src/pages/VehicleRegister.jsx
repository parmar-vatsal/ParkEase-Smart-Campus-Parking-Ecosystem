import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Car, Bike, CarFront, Palette, Type, Hash, CheckCircle, ArrowLeft, Lock } from 'lucide-react'

export default function VehicleRegister() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')
    const [form, setForm] = useState({
        vehicleNumber: '',
        vehicleType: 'two_wheeler',
        brand: '',
        model: '',
        color: '',
    })

    const [existingVehicles, setExistingVehicles] = useState([])
    const [fetching, setFetching] = useState(true)

    useEffect(() => {
        const fetchExisting = async () => {
            const { data } = await supabase
                .from('parkease_vehicles')
                .select('vehicle_type, status')
                .eq('owner_id', profile.id)
            setExistingVehicles(data || [])
            setFetching(false)
        }
        if (profile?.id) fetchExisting()
    }, [profile?.id])

    const twCount = existingVehicles.filter(v => v.vehicle_type === 'two_wheeler' && v.status !== 'rejected').length
    const fwCount = existingVehicles.filter(v => v.vehicle_type === 'four_wheeler' && v.status !== 'rejected').length
    const totalCount = twCount + fwCount

    const hasEmergencyPass = profile?.emergency_vehicle_until && new Date(profile.emergency_vehicle_until) > new Date()
    const maxTotalVehicles = hasEmergencyPass ? 3 : 1

    let daysSinceDelete = 90
    if (profile?.last_vehicle_deleted_at) {
        daysSinceDelete = Math.floor((new Date() - new Date(profile.last_vehicle_deleted_at)) / (1000 * 60 * 60 * 24))
    }
    const isUnder90DayPenalty = daysSinceDelete < 90

    const isLimitReached = (type) => {
        if (isUnder90DayPenalty) return true
        if (totalCount >= maxTotalVehicles) return true
        if (type === 'four_wheeler') return fwCount >= 1
        return false
    }

    const updateForm = (key, value) => {
        setForm(prev => ({ ...prev, [key]: value }))
        setError('')
    }

    const formatVehicleNumber = (value) => {
        return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        if (isUnder90DayPenalty) {
            setError(`You cannot add another vehicle until the 90-day period has passed. (${90 - daysSinceDelete} days remaining)`)
            setLoading(false)
            return
        }

        if (isLimitReached(form.vehicleType)) {
            setError(`Registration limit reached. Total allowed: ${maxTotalVehicles}. Please remove an existing vehicle first.`)
            setLoading(false)
            return
        }

        // Enforce strong Indian license plate format
        if (!/^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/.test(form.vehicleNumber)) {
            setError('Invalid format. Use Indian standard: GJ05AB1234')
            setLoading(false)
            return
        }

        try {
            // Zone Allocation Logic
            let allocatedZoneId = null;
            if (profile?.department) {
                const { data: deptZones } = await supabase
                    .from('parkease_zone_departments')
                    .select('zone_id')
                    .eq('department_code', profile.department)
                    .order('priority', { ascending: true })
                    .limit(1);

                if (deptZones && deptZones.length > 0) {
                    allocatedZoneId = deptZones[0].zone_id;
                }
            }

            // Fallback if no department mapped zone
            if (!allocatedZoneId) {
                const { data: anyZone } = await supabase
                    .from('parkease_zones')
                    .select('id')
                    .eq('status', 'active')
                    .limit(1);
                if (anyZone && anyZone.length > 0) {
                    allocatedZoneId = anyZone[0].id;
                }
            }

            const insertPayload = {
                owner_id: profile.id,
                vehicle_number: form.vehicleNumber,
                vehicle_type: form.vehicleType,
                brand: form.brand,
                model: form.model,
                color: form.color,
            }

            if (allocatedZoneId) {
                insertPayload.allocated_zone_id = allocatedZoneId;
            }

            const { error: insertErr } = await supabase.from('parkease_vehicles').insert([insertPayload])

            if (insertErr) {
                console.error("Supabase Insert Error Body:", insertErr);
                throw insertErr;
            }

            setSuccess(true)
            setTimeout(() => navigate('/student/vehicles'), 2000)
        } catch (err) {
            console.error('Registration error:', err)
            setError(err.message || 'Failed to register vehicle. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', minHeight: '60vh', textAlign: 'center'
            }}
                className="animate-fade-in-up">
                <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 24, boxShadow: '0 0 30px rgba(16, 185, 129, 0.2)'
                }}>
                    <CheckCircle size={40} color="#10b981" />
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 8, background: 'linear-gradient(to right, #10b981, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Registration Successful!
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: 20 }}>
                    Vehicle <b>{form.vehicleNumber}</b> is now linked to your profile.
                </p>
                <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '12px 20px', borderRadius: 12, color: '#818cf8', fontSize: '0.9rem', fontWeight: 600, marginBottom: 24, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Hash size={16} /> Campus Entry Authorized
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b', fontSize: '0.85rem' }}>
                    <div className="spinner" style={{ width: 14, height: 14 }} />
                    Redirecting to your vehicles...
                </div>
            </div>
        )
    }

    return (
        <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 40 }} className="animate-fade-in">
            <button onClick={() => navigate(-1)} className="btn btn-ghost" style={{ marginBottom: 24, padding: '8px 16px', borderRadius: 10 }}>
                <ArrowLeft size={16} /> Back
            </button>

            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: 8, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Register Vehicle <span style={{ fontSize: '0.8rem', color: '#6366f1', background: 'rgba(99, 102, 241, 0.1)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>v1.2</span>
                </h1>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
                    Enter your vehicle details to enable smart entry & parking
                </p>
            </div>

            <form onSubmit={handleSubmit} className="glass-card" style={{ padding: 32, boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
                {error && (
                    <div style={{
                        padding: '12px 16px', borderRadius: 12, marginBottom: 24,
                        background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)',
                        color: '#f43f5e', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 10
                    }}>
                        <Lock size={16} /> {error}
                    </div>
                )}

                {isUnder90DayPenalty && !error && (
                    <div style={{
                        padding: '12px 16px', borderRadius: 12, marginBottom: 24,
                        background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)',
                        color: '#f43f5e', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 10
                    }}>
                        <Lock size={16} /> You cannot add another vehicle until the 90-day period has passed. ({90 - daysSinceDelete} days remaining)
                    </div>
                )}

                {hasEmergencyPass && (
                    <div style={{ marginBottom: 24, padding: 16, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 12, color: '#10b981', fontSize: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <CheckCircle size={20} style={{ flexShrink: 0, marginTop: 1 }} />
                        <div>
                            <div style={{ fontWeight: 700, marginBottom: 2 }}>Emergency Pass Active</div>
                            <div style={{ color: '#34d399', fontSize: '0.8rem', opacity: 0.8 }}>3rd vehicle registration allowed until {new Date(profile.emergency_vehicle_until).toLocaleDateString()}.</div>
                        </div>
                    </div>
                )}

                {/* Vehicle Type Selection */}
                <div style={{ marginBottom: 28 }}>
                    <label className="label" style={{ marginBottom: 12 }}>Select Vehicle Type</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            { value: 'two_wheeler', label: '2-Wheeler', icon: Bike, desc: 'Bike / Scooter', count: twCount },
                            { value: 'four_wheeler', label: '4-Wheeler', icon: CarFront, desc: 'Car / SUV', count: fwCount },
                        ].map(({ value, label, icon: Icon, count }) => {
                            const locked = isLimitReached(value)
                            const isSelected = form.vehicleType === value
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => !locked && updateForm('vehicleType', value)}
                                    style={{
                                        position: 'relative', padding: '20px 16px', borderRadius: 16, textAlign: 'center',
                                        background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255,255,255,0.02)',
                                        border: isSelected ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.06)',
                                        cursor: locked ? 'not-allowed' : 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        color: 'white', opacity: locked && !isSelected ? 0.4 : 1,
                                        transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                                    }}
                                >
                                    <Icon size={32} color={isSelected ? '#818cf8' : '#475569'} style={{ marginBottom: 10 }} />
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                        {label}
                                        {locked && <Lock size={12} color="#f43f5e" />}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: locked ? '#f43f5e' : isSelected ? '#818cf8' : '#64748b', marginTop: 4, fontWeight: 500 }}>
                                        {value === 'four_wheeler' ? `${count}/1 Registered` : `${count} Registered`}
                                    </div>
                                    {isSelected && <div style={{ position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Vehicle Number */}
                <div style={{ marginBottom: 24 }}>
                    <label className="label">Vehicle Number</label>
                    <div style={{ position: 'relative' }}>
                        <Hash size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                        <input
                            className="input"
                            style={{ paddingLeft: 44, height: 50, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, fontSize: '1rem' }}
                            placeholder="GJ05AB1234"
                            value={form.vehicleNumber}
                            onChange={(e) => updateForm('vehicleNumber', formatVehicleNumber(e.target.value))}
                            maxLength={10}
                            required
                        />
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle size={12} /> Format: State + RTO + Series + Number (No Spaces)
                    </p>
                </div>

                {/* Brand & Model */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                    <div>
                        <label className="label">Brand</label>
                        <div style={{ position: 'relative' }}>
                            <Type size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                            <input className="input" style={{ paddingLeft: 40, height: 48 }} placeholder="e.g. Honda"
                                value={form.brand} onChange={(e) => updateForm('brand', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className="label">Model</label>
                        <input className="input" style={{ height: 48 }} placeholder="e.g. Activa 6G"
                            value={form.model} onChange={(e) => updateForm('model', e.target.value)} />
                    </div>
                </div>

                {/* Color */}
                <div style={{ marginBottom: 32 }}>
                    <label className="label">Vehicle Color</label>
                    <div style={{ position: 'relative' }}>
                        <Palette size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                        <input className="input" style={{ paddingLeft: 40, height: 48 }} placeholder="e.g. Matte Black"
                            value={form.color} onChange={(e) => updateForm('color', e.target.value)} />
                    </div>
                </div>

                <button
                    type="submit"
                    className="btn btn-primary btn-xl"
                    style={{ width: '100%' }}
                    disabled={loading || fetching || isLimitReached(form.vehicleType)}
                >
                    {loading ? <div className="spinner" /> :
                        isLimitReached(form.vehicleType) ? <>Limit Reached <Lock size={18} /></> :
                            <>Register Vehicle <CheckCircle size={18} /></>}
                </button>
            </form>
        </div>
    )
}
