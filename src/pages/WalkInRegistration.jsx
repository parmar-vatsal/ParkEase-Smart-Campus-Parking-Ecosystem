import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Car, User, Phone, CheckCircle, Clock } from 'lucide-react'

export default function WalkInRegistration() {
    const [form, setForm] = useState({
        guest_name: '',
        guest_phone: '',
        vehicle_number: '',
        vehicle_type: 'two_wheeler',
        purpose: 'Admission Inquiry'
    })
    const [loading, setLoading] = useState(false)
    const [successData, setSuccessData] = useState(null)
    const [errorMsg, setErrorMsg] = useState(null)

    const generatePassString = (guestName, vehicleNumber) => {
        const expiry = new Date()
        expiry.setHours(expiry.getHours() + 2) // 2 hours for walk-ins
        return JSON.stringify({
            type: "GUEST",
            sn: "WALK-IN",
            gn: guestName,
            vn: vehicleNumber,
            exp: expiry.getTime()
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setErrorMsg(null)

        const vn = form.vehicle_number.toUpperCase().replace(/[^A-Z0-9]/g, '')
        if (!/^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/.test(vn)) {
            setErrorMsg('Invalid vehicle number format (e.g. GJ05AB1234)')
            setLoading(false)
            return
        }

        const phone = form.guest_phone.replace(/\D/g, '')
        if (phone.length !== 10) {
            setErrorMsg('Phone number must be exactly 10 digits')
            setLoading(false)
            return
        }

        // Phase 11: Spam Prevention — check for existing active/pending pass for this phone
        const { data: existingPass } = await supabase
            .from('parkease_guest_passes')
            .select('id, status, valid_until')
            .eq('guest_phone', phone)
            .in('status', ['pending_approval', 'pending', 'active'])
            .limit(1)
            .maybeSingle()

        if (existingPass) {
            const expiry = new Date(existingPass.valid_until)
            const isStillValid = expiry > new Date()
            if (isStillValid || existingPass.status === 'pending_approval') {
                setErrorMsg(`A parking request for this phone number is already pending or active. Please wait for it to expire or be processed by the guard.`)
                setLoading(false)
                return
            }
        }

        const valid_until = new Date()
        valid_until.setHours(valid_until.getHours() + 2) // 2 hours for pending walk-ins

        const token = generatePassString(form.guest_name, vn)
        const otp = Math.floor(100000 + Math.random() * 900000).toString()

        const { data, error: insertErr } = await supabase.from('parkease_guest_passes').insert([{
            sponsor_id: null,
            guest_name: form.guest_name.trim(),
            guest_email: 'walkin@scet.ac.in', // Default dummy
            guest_phone: phone,
            vehicle_number: vn,
            vehicle_type: form.vehicle_type,
            purpose: form.purpose,
            valid_until: valid_until.toISOString(),
            max_duration_minutes: 120,
            qr_code_token: token,
            otp_code: otp,
            status: 'pending_approval' // Explicit start state
        }]).select()

        if (insertErr) {
            console.error("Insert error:", insertErr)
            
            let displayError = 'Error registering. Please try again or see the guard.'
            if (insertErr.message?.includes('duplicate key value') || String(insertErr.code) === '23505') {
                if (insertErr.message?.includes('vehicle_number')) {
                    displayError = 'A pass for this vehicle number already exists or is pending.'
                }
            }
            
            setErrorMsg(displayError)
        } else {
            setSuccessData({ otp, vn, name: form.guest_name })
        }
        setLoading(false)
    }

    if (successData) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="animated-bg" />
                <div className="glass-card w-full max-w-md p-8 text-center animate-fade-in-up">
                    <div style={{ width: 64, height: 64, background: 'rgba(16,185,129,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <CheckCircle size={32} color="#10b981" />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 8 }}>Registration Sent!</h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: 24 }}>
                        Please provide the OTP below to the Security Guard at the gate to get entry approval.
                    </p>

                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.2)', marginBottom: 24 }}>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Your Entry OTP</p>
                        <h1 style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: 8, color: '#f1f5f9', margin: 0 }}>{successData.otp}</h1>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left bg-black/20 p-4 rounded-xl">
                        <div>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>GUEST NAME</span>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{successData.name}</div>
                        </div>
                        <div>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>VEHICLE NO.</span>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#6366f1' }}>{successData.vn}</div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="animated-bg" />
            <div className="glass-card w-full max-w-md p-6 sm:p-8 animate-fade-in-up">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/10 mb-4">
                        <User className="text-indigo-400" size={24} />
                    </div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                        Visitor Parking
                    </h1>
                    <p className="text-slate-400 text-sm mt-2">
                        SCET Campus Walk-in Registration
                    </p>
                </div>

                {errorMsg && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm p-3 rounded-lg mb-6 text-center">
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="label">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                required
                                className="input"
                                style={{ paddingLeft: 40 }}
                                placeholder="Rahul Sharma"
                                value={form.guest_name}
                                onChange={e => setForm({ ...form, guest_name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="label">Phone Number</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                required
                                type="tel"
                                maxLength="10"
                                className="input"
                                style={{ paddingLeft: 40 }}
                                placeholder="9876543210"
                                value={form.guest_phone}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                                    setForm({ ...form, guest_phone: val })
                                }}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="label">Vehicle Number</label>
                        <div className="relative">
                            <Car className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                required
                                maxLength="10"
                                className="input"
                                style={{ paddingLeft: 40, textTransform: 'uppercase' }}
                                placeholder="GJ05AB1234"
                                value={form.vehicle_number}
                                onChange={e => {
                                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
                                    setForm({ ...form, vehicle_number: val })
                                }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Vehicle Type</label>
                            <select className="select" value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })}>
                                <option value="two_wheeler">2-Wheeler</option>
                                <option value="four_wheeler">4-Wheeler</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Purpose</label>
                            <select className="select" value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })}>
                                <option value="Admission Inquiry">Admission</option>
                                <option value="Delivery">Delivery / Courier</option>
                                <option value="Contractor">Maintenance / IT</option>
                                <option value="Official Visit">Official Visit</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary w-full mt-6"
                        style={{ height: '48px', fontSize: '1rem' }}
                    >
                        {loading ? <div className="spinner" /> : 'Request Entry Pass'}
                    </button>

                    <p style={{ textAlign: 'center', fontSize: '0.7rem', color: '#64748b', marginTop: 16 }}>
                        <Clock size={12} style={{ display: 'inline', marginRight: 4, transform: 'translateY(-1px)' }} />
                        Passes are valid for 4 hours after guard approval.
                    </p>
                </form>
            </div>
        </div>
    )
}
