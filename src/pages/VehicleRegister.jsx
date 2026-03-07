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

    // ── 90-Day Policy ──────────────────────────────────────────────────────────
    // Track both addition and deletion. Whichever happened more recently drives the cooldown.
    const daysSinceDelete = profile?.last_vehicle_deleted_at
        ? Math.floor((new Date() - new Date(profile.last_vehicle_deleted_at)) / (1000 * 60 * 60 * 24))
        : 999
    const daysSinceAdd = profile?.last_vehicle_added_at
        ? Math.floor((new Date() - new Date(profile.last_vehicle_added_at)) / (1000 * 60 * 60 * 24))
        : 999

    const isUnder90DayDeletePenalty = daysSinceDelete < 90
    const isUnder90DayAddPenalty = daysSinceAdd < 90
    // Combined: blocked if EITHER a recent add or delete is within 90 days
    const isUnder90DayPenalty = isUnder90DayDeletePenalty || isUnder90DayAddPenalty

    // The cooldown message changes depending on the reason
    const penaltyReason = isUnder90DayDeletePenalty
        ? `You deleted a vehicle ${daysSinceDelete} day(s) ago.`
        : `You registered a vehicle ${daysSinceAdd} day(s) ago.`
    const daysRemaining = isUnder90DayDeletePenalty
        ? 90 - daysSinceDelete
        : 90 - daysSinceAdd

    // ── Per-Type Limits ────────────────────────────────────────────────────────
    // Max: 2 two-wheelers, 1 four-wheeler (Emergency pass grants an extra 4W slot)
    const hasEmergencyPass = profile?.emergency_vehicle_until && new Date(profile.emergency_vehicle_until) > new Date()
    const maxFW = hasEmergencyPass ? 2 : 1
    const maxTW = 2

    const isLimitReached = (type) => {
        if (isUnder90DayPenalty) return true
        if (type === 'two_wheeler') return twCount >= maxTW
        if (type === 'four_wheeler') return fwCount >= maxFW
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
            setError(`🚫 ${penaltyReason} You cannot register another vehicle until the 90-day policy period has passed. (${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining)`)
            setLoading(false)
            return
        }

        if (isLimitReached(form.vehicleType)) {
            if (form.vehicleType === 'two_wheeler') {
                setError(`You have reached the maximum of ${maxTW} two-wheeler(s). Remove an existing one before adding another.`)
            } else {
                setError(`You have reached the maximum of ${maxFW} four-wheeler(s). Remove an existing one before adding another.`)
            }
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

            // Track the addition timestamp for the 90-day cooldown
            await supabase
                .from('parkease_profiles')
                .update({ last_vehicle_added_at: new Date().toISOString() })
                .eq('id', profile.id)

            setSuccess(true)
            setTimeout(() => navigate('/student/vehicles'), 2000)
        } catch (err) {
            console.error('Registration error:', err)
            
            let displayError = err.message || 'Failed to register vehicle. Please try again.'
            
            // Catch Postgres unique constraint exceptions
            if (displayError.includes('duplicate key value') || String(err.code) === '23505') {
                if (displayError.includes('vehicle_number')) {
                    displayError = 'This vehicle number is already registered in the system.'
                } else {
                    displayError = 'This vehicle already exists in the system.'
                }
            }
            
            setError(displayError)
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
                        padding: '14px 16px', borderRadius: 12, marginBottom: 24,
                        background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)',
                        color: '#f43f5e', fontSize: '0.85rem',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <Lock size={16} />
                            <span style={{ fontWeight: 700 }}>90-Day Policy Active</span>
                        </div>
                        <div style={{ paddingLeft: 26, lineHeight: 1.6 }}>
                            {penaltyReason} You cannot add another vehicle for <b>{daysRemaining} more day{daysRemaining !== 1 ? 's' : ''}</b>.
                        </div>
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
                            { value: 'two_wheeler', label: '2-Wheeler', icon: Bike, desc: 'Bike / Scooter', count: twCount, max: maxTW },
                            { value: 'four_wheeler', label: '4-Wheeler', icon: CarFront, desc: 'Car / SUV', count: fwCount, max: maxFW },
                        ].map(({ value, label, icon: Icon, count, max }) => {
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
                                    <Icon size={32} color={isSelected ? '#818cf8' : '#475569'} style={{ marginBottom: 10, margin: '0 auto' }} />
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginTop: 10 }}>
                                        {label}
                                        {locked && <Lock size={12} color="#f43f5e" />}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: locked ? '#f43f5e' : isSelected ? '#818cf8' : '#64748b', marginTop: 4, fontWeight: 500, width: '100%', textAlign: 'center' }}>
                                        {count}/{max} Registered
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
                            style={{ paddingLeft: 46, height: 50, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, fontSize: '1rem' }}
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
