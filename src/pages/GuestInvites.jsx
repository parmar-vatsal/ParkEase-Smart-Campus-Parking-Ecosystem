import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { QRCodeSVG } from 'qrcode.react'
import { Ticket, Download, Clock, CheckCircle, XCircle } from 'lucide-react'

export default function GuestInvites() {
    const { profile } = useAuth()
    const [passes, setPasses] = useState([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [successMsg, setSuccessMsg] = useState('')

    const [form, setForm] = useState({
        guest_name: '',
        guest_email: '',
        guest_phone: '',
        vehicle_number: '',
        vehicle_type: 'two_wheeler',
        purpose: '',
        duration_hours: 4
    })

    useEffect(() => {
        fetchPasses()
    }, [])

    const fetchPasses = async () => {
        const { data } = await supabase
            .from('parkease_guest_passes')
            .select('*')
            .eq('sponsor_id', profile.id)
            .order('created_at', { ascending: false })

        setPasses(data || [])
        setLoading(false)
    }

    const generatePassString = (guestName, vehicleNumber, durationHours) => {
        // Since we don't have a secure backend signing JWTs right now, 
        // we create a structured JSON payload that the guard scanner can interpret as a Guest Pass
        const expiry = new Date()
        expiry.setHours(expiry.getHours() + parseInt(durationHours))

        return JSON.stringify({
            type: "GUEST",
            sn: profile.full_name, // sponsor name
            gn: guestName,
            vn: vehicleNumber,
            exp: expiry.getTime()
        })
    }

    const handleCreatePass = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        setError('')
        setSuccessMsg('')

        // 1. Daily Limit Check
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const passesToday = passes.filter(p => new Date(p.created_at) >= today)
        const dailyLimit = profile?.role === 'student' ? 2 : 5

        if (passesToday.length >= dailyLimit) {
            setError(`Daily limit reached! As a ${profile?.role}, you can only invite ${dailyLimit} guests per day.`)
            setSubmitting(false)
            return
        }

        // Validate vehicle number format
        const vn = form.vehicle_number.toUpperCase().replace(/[^A-Z0-9]/g, '')
        if (!/^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/.test(vn)) {
            setError('Invalid format. Use Indian standard: GJ05AB1234')
            setSubmitting(false)
            return
        }

        // 2. Duplicate Check
        const isDuplicate = passesToday.some(p => p.vehicle_number === vn && p.status !== 'cancelled')
        if (isDuplicate) {
            setError('This vehicle already has an active guest pass for today.')
            setSubmitting(false)
            return
        }

        const valid_until = new Date()
        valid_until.setHours(valid_until.getHours() + parseInt(form.duration_hours))

        const token = generatePassString(form.guest_name, vn, form.duration_hours)
        const otp = Math.floor(100000 + Math.random() * 900000).toString()

        const { error: insertErr } = await supabase.from('parkease_guest_passes').insert([{
            sponsor_id: profile.id,
            guest_name: form.guest_name,
            guest_email: form.guest_email,
            guest_phone: form.guest_phone,
            vehicle_number: vn,
            vehicle_type: form.vehicle_type,
            purpose: form.purpose,
            valid_until: valid_until.toISOString(),
            max_duration_minutes: parseInt(form.duration_hours) * 60,
            qr_code_token: token,
            otp_code: otp
        }])

        if (insertErr) {
            setError('Failed to create guest pass: ' + insertErr.message)
            setSubmitting(false)
            return
        }

        setSuccessMsg(`Guest pass created! OTP for manual entry: ${otp}`)
        setForm({
            guest_name: '', guest_email: '', guest_phone: '',
            vehicle_number: '', vehicle_type: 'two_wheeler', purpose: '', duration_hours: 4
        })

        // Refresh list
        fetchPasses()
        setSubmitting(false)
    }

    const downloadQR = (pass) => {
        const svg = document.getElementById(`qr-${pass.id}`)
        if (!svg) return

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const data = new XMLSerializer().serializeToString(svg)
        const img = new Image()
        const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' })
        const url = URL.createObjectURL(svgBlob)

        img.onload = () => {
            canvas.width = 300
            canvas.height = 400 // Slightly taller for extra info
            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 30, 20, 240, 240)

            ctx.fillStyle = '#1e293b'
            ctx.font = 'bold 20px Inter, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText('GUEST PARKING PASS', 150, 290)

            ctx.font = 'bold 16px Inter, sans-serif'
            ctx.fillStyle = '#6366f1' // Indigo
            ctx.fillText(pass.vehicle_number, 150, 315)

            ctx.font = '12px Inter, sans-serif'
            ctx.fillStyle = '#64748b'
            ctx.fillText(`Guest: ${pass.guest_name}`, 150, 340)

            const expiryTime = new Date(pass.valid_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            ctx.fillStyle = '#f43f5e' // Red expiry
            ctx.fillText(`Valid Until Today ${expiryTime}`, 150, 360)

            ctx.fillStyle = '#94a3b8'
            ctx.fillText(`OTP: ${pass.otp_code}`, 150, 380)

            const link = document.createElement('a')
            link.download = `GuestPass_${pass.vehicle_number}.png`
            link.href = canvas.toDataURL('image/png')
            link.click()
            URL.revokeObjectURL(url)
        }
        img.src = url
    }

    const statusConfig = {
        pending: { color: '#f59e0b', bg: 'badge-warning', icon: Clock, label: 'Unused' },
        active: { color: '#10b981', bg: 'badge-success', icon: CheckCircle, label: 'Inside Campus' },
        exited: { color: '#64748b', bg: 'badge-info', icon: CheckCircle, label: 'Exited' },
        expired: { color: '#f43f5e', bg: 'badge-danger', icon: XCircle, label: 'Expired' }
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
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Ticket size={24} color="#818cf8" />
                Invite a Guest
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: 32 }}>
                Create temporary 1-day parking passes for your visitors. <strong>You are strictly responsible for their parking behavior.</strong>
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, alignItems: 'start' }}>

                {/* Form Section */}
                <div className="glass-card animate-fade-in-up" style={{ padding: 24 }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 20 }}>Create New Guest Pass</h2>

                    {error && (
                        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(244,63,94,0.1)', color: '#f43f5e', fontSize: '0.85rem', marginBottom: 20, borderLeft: '3px solid #f43f5e' }}>
                            {error}
                        </div>
                    )}

                    {successMsg && (
                        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '0.85rem', marginBottom: 20, borderLeft: '3px solid #10b981' }}>
                            {successMsg}
                        </div>
                    )}

                    <form onSubmit={handleCreatePass}>
                        <div style={{ marginBottom: 16 }}>
                            <label className="label">Guest Full Name</label>
                            <input className="input" placeholder="Rahul Sharma" value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} required />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="label">Guest Email</label>
                                <input type="email" className="input" placeholder="Email (for QR)" value={form.guest_email} onChange={(e) => setForm({ ...form, guest_email: e.target.value })} required />
                            </div>
                            <div>
                                <label className="label">Phone (Optional)</label>
                                <input className="input" placeholder="+91" value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="label">Vehicle Number <span style={{ color: '#f43f5e' }}>*</span></label>
                                <input className="input" placeholder="GJ05AB1234" maxLength={10} value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value.toUpperCase() })} required />
                            </div>
                            <div>
                                <label className="label">Vehicle Type</label>
                                <select className="input" value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}>
                                    <option value="two_wheeler">2 Wheeler</option>
                                    <option value="four_wheeler">4 Wheeler</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                            <div className="sm:col-span-2">
                                <label className="label">Purpose of Visit</label>
                                <select className="input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} required>
                                    <option value="" disabled>Select Purpose</option>
                                    <option value="Parent Visit">Parent/Relative Visit</option>
                                    <option value="Friend Visit">Friend Visit</option>
                                    <option value="Event/Function">Event or Function</option>
                                    <option value="Delivery">Delivery</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="label">Duration</label>
                                <select className="input" value={form.duration_hours} onChange={(e) => setForm({ ...form, duration_hours: e.target.value })}>
                                    <option value={2}>2 Hours</option>
                                    <option value={4}>4 Hours</option>
                                    <option value={8}>8 Hours</option>
                                </select>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
                            {submitting ? <div className="spinner" /> : 'Generate Guest Pass'}
                        </button>
                    </form>
                </div>

                {/* List Section */}
                <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 20 }}>Your Recent Guests</h2>

                    {passes.length === 0 ? (
                        <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
                            <p style={{ color: '#64748b' }}>No guest passes created yet.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {passes.map((pass) => {
                                // Auto flag expired based on current time if not exited
                                const isExpired = new Date() > new Date(pass.valid_until)
                                const currentStatus = (isExpired && pass.status !== 'exited') ? 'expired' : pass.status
                                const status = statusConfig[currentStatus] || statusConfig.pending

                                return (
                                    <div key={pass.id} className="glass-card" style={{ padding: 20, display: 'flex', gap: 16, alignItems: 'center' }}>
                                        {/* Hidden QR Code for downloading */}
                                        <div style={{ display: 'none' }}>
                                            <QRCodeSVG
                                                id={`qr-${pass.id}`}
                                                value={pass.qr_code_token}
                                                size={240}
                                                level="H"
                                                includeMargin={false}
                                                fgColor="#1e293b"
                                                bgColor="#ffffff"
                                            />
                                        </div>

                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                                <h3 style={{ fontWeight: 700, fontSize: '0.95rem' }}>{pass.guest_name}</h3>
                                                <span className={`badge ${status.bg}`} style={{ fontSize: '0.65rem' }}>
                                                    <status.icon size={10} /> {status.label}
                                                </span>
                                            </div>
                                            <div style={{ color: '#818cf8', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 4 }}>
                                                {pass.vehicle_number} • OTP: {pass.otp_code}
                                            </div>
                                            <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: 12 }}>
                                                Expires: {new Date(pass.valid_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>

                                            <button
                                                className="btn btn-ghost"
                                                onClick={() => downloadQR(pass)}
                                                style={{ padding: '6px 12px', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)' }}
                                            >
                                                <Download size={14} style={{ marginRight: 6 }} /> Share QR Code
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}
