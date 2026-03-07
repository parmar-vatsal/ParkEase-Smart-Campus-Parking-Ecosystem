import { useState, useEffect } from 'react'
import { supabase, supabaseSecondary } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { QRCodeSVG } from 'qrcode.react'
import {
    LayoutDashboard, Search, Car, Users, TrendingUp, ArrowDownCircle,
    ArrowUpCircle, Bike, CarFront, Phone, Mail, Building, Hash, Clock,
    CheckCircle, XCircle, Shield, Eye, Ban, MapPin, User, Lock,
    ChevronRight, AlertCircle, AlertTriangle, UserPlus, Ticket, Map as MapIcon
} from 'lucide-react'
import AddGuardForm from '../components/admin/AddGuardForm'
import AdminGuestPassTab from '../components/admin/AdminGuestPassTab'
import AdminVehicleDetails from '../components/admin/AdminVehicleDetails'
import AdminZonesTab from '../components/admin/AdminZonesTab'

// ─── Left sidebar nav items ───────────────────────────────────────────────────
const NAV_ITEMS = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, desc: 'Stats & capacity' },
    { id: 'zones', label: 'Zones & Areas', icon: MapIcon, desc: 'Manage parking zones' },
    { id: 'search', label: 'Search & Lookup', icon: Search, desc: 'Find vehicles / users' },
    { id: 'vehicles', label: 'Vehicles', icon: Car, desc: 'All registrations' },
    { id: 'capacity', label: 'Zone Capacity', icon: TrendingUp, desc: 'Live slot status' },
    { id: 'guests', label: 'Guest Passes', icon: Ticket, desc: 'Manage guest parking' },
    { id: 'guards', label: 'Add Guard', icon: Shield, desc: 'Create guard account' },
]
export default function AdminDashboard() {
    const { profile } = useAuth()
    const [activeTab, setActiveTab] = useState('overview')
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({ totalVehicles: 0, currentlyInside: 0, todayEntries: 0, todayExits: 0, totalUsers: 0, pendingApprovals: 0 })
    const [capacity, setCapacity] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [searchLoading, setSearchLoading] = useState(false)
    const [searchError, setSearchError] = useState(null)
    const [selectedVehicle, setSelectedVehicle] = useState(null)
    const [vehicleHistory, setVehicleHistory] = useState([])
    const [allVehicles, setAllVehicles] = useState([])
    const [allGuests, setAllGuests] = useState([])
    const [overstayLogs, setOverstayLogs] = useState([])

    // Guard form state
    const [guardForm, setGuardForm] = useState({ fullName: '', email: '', phone: '', password: '' })
    const [guardLoading, setGuardLoading] = useState(false)
    const [guardMessage, setGuardMessage] = useState(null)

    // Admin Event Pass state
    const [adminPassForm, setAdminPassForm] = useState({
        guest_name: '',
        vehicle_number: '',
        vehicle_type: 'four_wheeler',
        duration_hours: 8,
        purpose: 'Event/Function'
    })
    const [adminPassLoading, setAdminPassLoading] = useState(false)
    const [adminPassMsg, setAdminPassMsg] = useState(null)

    useEffect(() => {
        fetchAll()
        const interval = setInterval(fetchCapacity, 10000)
        return () => clearInterval(interval)
    }, [])

    const fetchAll = async () => {
        await Promise.all([fetchStats(), fetchCapacity(), fetchAllVehicles(), fetchAllGuests(), fetchOverstayLogs()])
        setLoading(false)
    }

    const fetchStats = async () => {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        
        // Count total vehicles
        const { count: totalVehicles } = await supabase.from('parkease_vehicles').select('*', { count: 'exact', head: true })
        // Count currently inside
        const { count: currentlyInside } = await supabase.from('parkease_logs').select('*', { count: 'exact', head: true }).eq('status', 'inside')
        // Count entries today
        const { count: todayEntries } = await supabase.from('parkease_logs').select('*', { count: 'exact', head: true }).gte('entry_time', today.toISOString())
        // Count exits today (only those with status exited and exit_time >= today)
        const { count: todayExits } = await supabase.from('parkease_logs').select('*', { count: 'exact', head: true }).not('exit_time', 'is', null).gte('exit_time', today.toISOString())
        // Total users
        const { count: totalUsers } = await supabase.from('parkease_profiles').select('*', { count: 'exact', head: true })
        // Pending approvals
        const { count: pendingApprovals } = await supabase.from('parkease_vehicles').select('*', { count: 'exact', head: true }).eq('status', 'pending_approval')
        
        setStats({ 
            totalVehicles: totalVehicles || 0, 
            currentlyInside: currentlyInside || 0, 
            todayEntries: todayEntries || 0, 
            todayExits: todayExits || 0, 
            totalUsers: totalUsers || 0, 
            pendingApprovals: pendingApprovals || 0 
        })
    }

    const fetchCapacity = async () => {
        const { data: zonesData } = await supabase
            .from('parkease_zones')
            .select('*')
            .eq('status', 'active')
            .order('name')

        const { data: activeLogs } = await supabase
            .from('parkease_logs')
            .select('zone_id, parkease_vehicles(vehicle_type)')
            .eq('status', 'inside')

        const capacityRows = []
        for (const zone of (zonesData || [])) {
            const inside2w = (activeLogs || []).filter(l => l.zone_id === zone.id && l.parkease_vehicles?.vehicle_type === 'two_wheeler').length
            const inside4w = (activeLogs || []).filter(l => l.zone_id === zone.id && l.parkease_vehicles?.vehicle_type === 'four_wheeler').length

            if (zone.capacity_2w_total > 0) {
                const total = zone.capacity_2w_total + (zone.capacity_2w_overflow || 0)
                capacityRows.push({ zone_id: zone.id, zone_name: zone.name, zone_code: zone.code, vehicle_type: 'two_wheeler', total_slots: total, available_slots: Math.max(0, total - inside2w), occupancy_percent: total > 0 ? Math.round((inside2w / total) * 100) : 0, occupied_slots: inside2w })
            }
            if (zone.capacity_4w_total > 0) {
                const total = zone.capacity_4w_total + (zone.capacity_4w_overflow || 0)
                capacityRows.push({ zone_id: zone.id, zone_name: zone.name, zone_code: zone.code, vehicle_type: 'four_wheeler', total_slots: total, available_slots: Math.max(0, total - inside4w), occupancy_percent: total > 0 ? Math.round((inside4w / total) * 100) : 0, occupied_slots: inside4w })
            }
        }
        setCapacity(capacityRows)
    }

    const fetchAllVehicles = async () => {
        const { data } = await supabase.from('parkease_vehicles').select('*, parkease_profiles(*)').order('created_at', { ascending: false }).limit(100)
        setAllVehicles(data || [])
    }

    const fetchAllGuests = async () => {
        const { data } = await supabase.from('parkease_guest_passes').select('*, parkease_profiles(*)').order('created_at', { ascending: false }).limit(100)
        setAllGuests(data || [])
    }

    const fetchOverstayLogs = async () => {
        // Vehicles inside for more than 24 hours
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data } = await supabase
            .from('parkease_logs')
            .select('*, parkease_zones(name)')
            .eq('status', 'inside')
            .lt('entry_time', cutoff)
            .order('entry_time', { ascending: true })
        setOverstayLogs(data || [])
    }

    const handleSearch = async (e) => {
        e.preventDefault()
        if (!searchQuery.trim()) return
        setSearchLoading(true)
        setSearchError(null)
        setSelectedVehicle(null)
        try {
            const q = searchQuery.trim()

            // 1. Search by vehicle number
            const { data: vehicles, error: vErr } = await supabase
                .from('parkease_vehicles')
                .select('*, parkease_profiles(*)')
                .ilike('vehicle_number', `%${q}%`)
                .limit(10)
            if (vErr) throw new Error('Vehicle query error: ' + vErr.message)

            // 2. Search profiles by name, phone, or enrollment ID in parallel
            const [{ data: pName }, { data: pPhone }, { data: pEnroll }] = await Promise.all([
                supabase.from('parkease_profiles').select('*').ilike('full_name', `%${q}%`).limit(10),
                supabase.from('parkease_profiles').select('*').ilike('phone', `%${q}%`).limit(10),
                supabase.from('parkease_profiles').select('*').ilike('enrollment_id', `%${q}%`).limit(10)
            ])

            // Deduplicate profiles
            const allProfiles = [...(pName || []), ...(pPhone || []), ...(pEnroll || [])]
            const uniqueProfiles = Array.from(new Map(allProfiles.map(p => [p.id, p])).values())

            let results = [...(vehicles || [])]

            if (uniqueProfiles.length > 0) {
                // Only fetch vehicles for profiles NOT already in results
                const profileIds = uniqueProfiles
                    .map(p => p.id)
                    .filter(id => !results.some(v => v.owner_id === id))
                if (profileIds.length > 0) {
                    const { data: more, error: moreErr } = await supabase
                        .from('parkease_vehicles')
                        .select('*, parkease_profiles(*)')
                        .in('owner_id', profileIds)
                    if (moreErr) throw new Error('Owner query error: ' + moreErr.message)
                    results = [...results, ...(more || [])]
                }
            }

            // Deduplicate results
            results = Array.from(new Map(results.map(v => [v.id, v])).values())

            // 3. Enrich each result: is it currently inside? which zone?
            if (results.length > 0) {
                const vIds = results.map(v => v.id)
                const { data: activeLogs } = await supabase
                    .from('parkease_logs')
                    .select('vehicle_id, zone_id, entry_time, parkease_zones(name)')
                    .in('vehicle_id', vIds)
                    .eq('status', 'inside')

                const insideMap = new Map(
                    (activeLogs || []).map(l => [l.vehicle_id, {
                        isInside: true,
                        zoneName: l.parkease_zones?.name || null,
                        entryTime: l.entry_time
                    }])
                )
                results = results.map(v => ({
                    ...v,
                    isInside: insideMap.has(v.id),
                    currentZone: insideMap.get(v.id)?.zoneName || null,
                    currentEntryTime: insideMap.get(v.id)?.entryTime || null
                }))
            }

            setSearchResults(results)
        } catch (err) {
            console.error(err)
            setSearchError(err.message || 'An error occurred during search')
            setSearchResults([])
        } finally {
            setSearchLoading(false)
        }
    }

    const viewVehicleDetails = async (vehicle) => {
        setSelectedVehicle(vehicle)
        const { data: history } = await supabase.from('parkease_logs').select('*, parkease_zones(name)').eq('vehicle_id', vehicle.id).order('entry_time', { ascending: false }).limit(20)
        setVehicleHistory(history || [])
    }

    const updateVehicleStatus = async (vehicleId, newStatus) => {
        await supabase.from('parkease_vehicles').update({ status: newStatus }).eq('id', vehicleId)
        fetchAllVehicles()
        fetchStats()
        if (selectedVehicle?.id === vehicleId) setSelectedVehicle(prev => ({ ...prev, status: newStatus }))
    }

    const grantEmergencyPass = async (userId) => {
        if (!confirm('Grant a 24-hour pass allowing a 3rd vehicle for this user?')) return
        const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        const { error } = await supabase.from('parkease_profiles').update({ emergency_vehicle_until: until }).eq('id', userId)
        if (error) {
            alert('Failed to grant pass: ' + error.message)
        } else {
            alert('Pass granted successfully valid for 24 hours.')
            if (selectedVehicle?.parkease_profiles?.id === userId) {
                setSelectedVehicle(prev => ({
                    ...prev,
                    parkease_profiles: {
                        ...prev.parkease_profiles,
                        emergency_vehicle_until: until
                    }
                }))
            }
        }
    }

    const generatePassString = (guestName, vehicleNumber, durationHours) => {
        const expiry = new Date()
        expiry.setHours(expiry.getHours() + parseInt(durationHours))
        return JSON.stringify({
            type: "GUEST",
            sn: "Admin / " + profile?.full_name,
            gn: guestName,
            vn: vehicleNumber,
            exp: expiry.getTime()
        })
    }

    const handleCreateAdminPass = async (e) => {
        e.preventDefault()
        setAdminPassLoading(true)
        setAdminPassMsg(null)

        const vn = adminPassForm.vehicle_number.toUpperCase().replace(/[^A-Z0-9]/g, '')
        if (!/^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/.test(vn)) {
            setAdminPassMsg({ type: 'error', text: 'Invalid vehicle number format (e.g. GJ05AB1234)' })
            setAdminPassLoading(false)
            return
        }

        const valid_until = new Date()
        valid_until.setHours(valid_until.getHours() + parseInt(adminPassForm.duration_hours))

        const token = generatePassString(adminPassForm.guest_name, vn, adminPassForm.duration_hours)
        const otp = Math.floor(100000 + Math.random() * 900000).toString()

        const { error: insertErr } = await supabase.from('parkease_guest_passes').insert([{
            sponsor_id: profile.id, // The admin's profile ID
            guest_name: adminPassForm.guest_name,
            guest_email: 'admin-generated@scet.ac.in', // dummy email for admin passes
            guest_phone: '',
            vehicle_number: vn,
            vehicle_type: adminPassForm.vehicle_type,
            purpose: adminPassForm.purpose,
            valid_until: valid_until.toISOString(),
            max_duration_minutes: parseInt(adminPassForm.duration_hours) * 60,
            qr_code_token: token,
            otp_code: otp
        }])

        if (insertErr) {
            let displayError = insertErr.message || 'Failed to generate guest pass.'
            if (displayError.includes('duplicate key value') || String(insertErr.code) === '23505') {
                if (displayError.includes('vehicle_number')) {
                    displayError = 'An active pass for this vehicle number already exists or is pending.'
                }
            }
            setAdminPassMsg({ type: 'error', text: 'Error: ' + displayError })
        } else {
            setAdminPassMsg({ type: 'success', text: `Success! Pass created. OTP: ${otp}` })
            setAdminPassForm({
                guest_name: '', vehicle_number: '', vehicle_type: 'four_wheeler', duration_hours: 8, purpose: 'Event/Function'
            })
            fetchAllGuests()
        }
        setAdminPassLoading(false)
    }

    const downloadQR = (pass) => {
        const svg = document.getElementById(`admin-qr-${pass.id}`)
        if (!svg) return

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const data = new XMLSerializer().serializeToString(svg)
        const img = new Image()
        const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' })
        const url = URL.createObjectURL(svgBlob)

        img.onload = () => {
            canvas.width = 300
            canvas.height = 400
            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 30, 20, 240, 240)

            ctx.fillStyle = '#1e293b'
            ctx.font = 'bold 20px Inter, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText('GUEST PARKING PASS', 150, 290)

            ctx.font = 'bold 16px Inter, sans-serif'
            ctx.fillStyle = '#6366f1'
            ctx.fillText(pass.vehicle_number, 150, 315)

            ctx.font = '12px Inter, sans-serif'
            ctx.fillStyle = '#64748b'
            ctx.fillText(`Guest: ${pass.guest_name} (Event/VIP)`, 150, 340)

            const expiryTime = new Date(pass.valid_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            ctx.fillStyle = '#f43f5e'
            ctx.fillText(`Valid Until: ${expiryTime}`, 150, 360)

            ctx.fillStyle = '#94a3b8'
            ctx.fillText(`OTP: ${pass.otp_code}`, 150, 380)

            const link = document.createElement('a')
            link.download = `EventPass_${pass.vehicle_number}.png`
            link.href = canvas.toDataURL('image/png')
            link.click()
            URL.revokeObjectURL(url)
        }
        img.src = url
    }

    const handleCancelPass = async (passId) => {
        if (!confirm('Are you sure you want to cancel this guest pass?')) return
        await supabase.from('parkease_guest_passes').update({ status: 'cancelled' }).eq('id', passId)
        fetchAllGuests()
    }

    const handleExtendTime = async (passId, currentUntil) => {
        if (!confirm('Extend this pass by 2 hours?')) return
        const newUntil = new Date(new Date(currentUntil).getTime() + 2 * 60 * 60 * 1000).toISOString()
        await supabase.from('parkease_guest_passes').update({ valid_until: newUntil }).eq('id', passId)
        fetchAllGuests()
    }

    const handleCreateGuard = async (e) => {
        e.preventDefault()
        setGuardLoading(true)
        setGuardMessage(null)
        const { error } = await supabaseSecondary.auth.signUp({
            email: guardForm.email,
            password: guardForm.password,
            options: { data: { full_name: guardForm.fullName, phone: guardForm.phone, role: 'guard' } }
        })
        if (error) {
            setGuardMessage({ type: 'error', text: error.message })
        } else {
            setGuardMessage({ type: 'success', text: `Guard account created for ${guardForm.fullName}! They can now log in at /login.` })
            setGuardForm({ fullName: '', email: '', phone: '', password: '' })
        }
        setGuardLoading(false)
    }

    const getCapacityColor = (pct) => pct >= 90 ? '#f43f5e' : pct >= 70 ? '#f59e0b' : '#10b981'

    const formatDuration = (mins) => {
        if (!mins) return '-'
        const h = Math.floor(mins / 60), m = mins % 60
        return h > 0 ? `${h}h ${m}m` : `${m}m`
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}>
                <div className="spinner" style={{ width: 32, height: 32 }} />
            </div>
        )
    }

    const currentNav = NAV_ITEMS.find(n => n.id === activeTab)

    return (
        <div style={{ display: 'flex', gap: 20, minHeight: 'calc(100vh - 80px)', alignItems: 'flex-start' }}>

            {/* ── LEFT SIDEBAR NAV ──────────────────────────────────── */}
            <div style={{
                width: 210, flexShrink: 0, position: 'sticky', top: 20,
                background: 'rgba(255,255,255,0.03)', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.07)', padding: 8,
            }}>
                {/* Admin title */}
                <div style={{ padding: '10px 12px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 8 }}>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Admin Panel</div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>ParkEase Control</div>
                </div>

                {/* Nav links */}
                {NAV_ITEMS.map(item => {
                    const active = activeTab === item.id
                    return (
                        <button
                            key={item.id}
                            onClick={() => { setActiveTab(item.id); setSelectedVehicle(null) }}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                padding: '10px 12px', borderRadius: 10, border: 'none',
                                background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                                color: active ? '#818cf8' : '#94a3b8',
                                cursor: 'pointer', transition: 'all 0.18s', textAlign: 'left',
                                marginBottom: 2, position: 'relative',
                            }}
                            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#e2e8f0' }}
                            onMouseLeave={e => { e.currentTarget.style.background = active ? 'rgba(99,102,241,0.15)' : 'transparent'; e.currentTarget.style.color = active ? '#818cf8' : '#94a3b8' }}
                        >
                            <item.icon size={16} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.8rem', lineHeight: 1.2 }}>{item.label}</div>
                                <div style={{ fontSize: '0.65rem', color: active ? 'rgba(129,140,248,0.7)' : '#475569', lineHeight: 1.2 }}>{item.desc}</div>
                            </div>
                            {/* Pending badge on Vehicles */}
                            {item.id === 'vehicles' && stats.pendingApprovals > 0 && (
                                <span style={{
                                    background: '#f43f5e', color: 'white', borderRadius: 99,
                                    fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center',
                                }}>{stats.pendingApprovals}</span>
                            )}
                            {active && <ChevronRight size={14} style={{ opacity: 0.5 }} />}
                        </button>
                    )
                })}

                {/* Quick stats at bottom of sidebar */}
                <div style={{ marginTop: 16, padding: '12px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.6rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Quick Stats</div>
                    {[
                        { label: 'Inside Now', value: stats.currentlyInside, color: '#10b981' },
                        { label: 'Today Entries', value: stats.todayEntries, color: '#818cf8' },
                        { label: 'Total Users', value: stats.totalUsers, color: '#f472b6' },
                    ].map(s => (
                        <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{s.label}</span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: s.color }}>{s.value}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── MAIN CONTENT AREA ────────────────────────────────── */}
            <div style={{ flex: 1, minWidth: 0 }}>

                {/* Page header */}
                <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <currentNav.icon size={18} color="#818cf8" />
                        <h1 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{currentNav.label}</h1>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '0.78rem' }}>{currentNav.desc}</p>
                </div>

                {/* ── OVERVIEW ─────────────────────────────────────── */}
                {activeTab === 'overview' && (
                    <div className="animate-fade-in">
                        {/* Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                            {[
                                { label: 'Registered', value: stats.totalVehicles, color: '#818cf8', icon: Car },
                                { label: 'Inside Now', value: stats.currentlyInside, color: '#10b981', icon: MapPin },
                                { label: 'Today In', value: stats.todayEntries, color: '#f59e0b', icon: ArrowDownCircle },
                                { label: 'Today Out', value: stats.todayExits, color: '#a78bfa', icon: ArrowUpCircle },
                                { label: 'Total Users', value: stats.totalUsers, color: '#f472b6', icon: Users },
                                { label: 'Pending', value: stats.pendingApprovals, color: stats.pendingApprovals > 0 ? '#f43f5e' : '#64748b', icon: Clock },
                            ].map(s => (
                                <div key={s.label} className="stat-card" style={{ cursor: 'default' }}>
                                    <s.icon size={18} color={s.color} />
                                    <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                                    <div className="stat-label">{s.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Pending approvals alert */}
                        {stats.pendingApprovals > 0 && (
                            <div
                                onClick={() => setActiveTab('vehicles')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                                    borderRadius: 12, marginBottom: 20, cursor: 'pointer',
                                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                                }}
                            >
                                <AlertCircle size={18} color="#f59e0b" />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f59e0b' }}>
                                        {stats.pendingApprovals} vehicle{stats.pendingApprovals !== 1 ? 's' : ''} pending approval
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Click to review in Vehicles tab</div>
                                </div>
                                <ChevronRight size={16} color="#f59e0b" />
                            </div>
                        )}

                        {/* Live Capacity */}
                        <div className="glass-card" style={{ padding: 20 }}>
                            <h3 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <TrendingUp size={16} color="#818cf8" /> Live Zone Capacity
                                <span className="badge badge-success" style={{ marginLeft: 'auto' }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> LIVE
                                </span>
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {capacity.map(zone => (
                                    <div key={zone.zone_id} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                                {zone.zone_name}
                                                <span className={`badge ${zone.vehicle_type === 'two_wheeler' ? 'badge-info' : 'badge-warning'}`} style={{ marginLeft: 8, fontSize: '0.6rem' }}>
                                                    {zone.vehicle_type === 'two_wheeler' ? '2W' : '4W'}
                                                </span>
                                            </span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: getCapacityColor(zone.occupancy_percent) }}>
                                                {zone.occupancy_percent}% • {zone.available_slots} free
                                            </span>
                                        </div>
                                        <div className="capacity-bar">
                                            <div className="capacity-bar-fill" style={{ width: `${zone.occupancy_percent || 0}%`, background: getCapacityColor(zone.occupancy_percent) }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Overstaying Vehicles Alert */}
                        {overstayLogs.length > 0 && (
                            <div className="glass-card" style={{ padding: 20, marginTop: 20, borderLeft: '3px solid #f43f5e' }}>
                                <h3 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, color: '#f43f5e' }}>
                                    <AlertCircle size={16} />
                                    ⚠️ Vehicles Overstaying (&gt;24 Hours)
                                    <span style={{ marginLeft: 'auto', background: '#f43f5e', color: 'white', borderRadius: 99, fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px' }}>{overstayLogs.length}</span>
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {overstayLogs.map(log => {
                                        const hoursInside = Math.round((Date.now() - new Date(log.entry_time).getTime()) / 3600000)
                                        return (
                                            <div key={log.id} style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '10px 14px', borderRadius: 10,
                                                background: 'rgba(244, 63, 94, 0.07)',
                                                border: '1px solid rgba(244, 63, 94, 0.2)',
                                                flexWrap: 'wrap', gap: 8
                                            }}>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fca5a5' }}>{log.vehicle_number}</div>
                                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>
                                                        Zone: {log.parkease_zones?.name || 'Unknown'} &nbsp;•&nbsp;
                                                        Entered: {new Date(log.entry_time).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                                <span style={{
                                                    background: 'rgba(244,63,94,0.2)', color: '#f43f5e',
                                                    padding: '4px 10px', borderRadius: 8,
                                                    fontWeight: 700, fontSize: '0.8rem'
                                                }}>
                                                    🕐 {hoursInside}h inside
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── SEARCH & LOOKUP ──────────────────────────────── */}
                {activeTab === 'search' && (
                    <div className="animate-fade-in">
                        <form onSubmit={handleSearch} style={{ marginBottom: 20 }}>
                            <label className="label">Search by vehicle number, name, phone, or enrollment ID</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                    <input
                                        className="input" style={{ paddingLeft: 40 }}
                                        placeholder="e.g. GJ01AB1234, Vatsal, 9876543210…"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <button type="submit" className="btn btn-primary" disabled={searchLoading}>
                                    {searchLoading ? <div className="spinner" /> : <><Search size={14} /> Search</>}
                                </button>
                            </div>
                        </form>

                        {searchError && (
                            <div style={{
                                padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: '0.8rem',
                                background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', color: '#f43f5e',
                                display: 'flex', alignItems: 'center', gap: 10
                            }}>
                                <AlertCircle size={16} /> {searchError}
                            </div>
                        )}

                        {/* Selected vehicle detail */}
                        {selectedVehicle ? (
                            <AdminVehicleDetails
                                selectedVehicle={selectedVehicle}
                                setSelectedVehicle={setSelectedVehicle}
                                vehicleHistory={vehicleHistory}
                                formatDuration={formatDuration}
                                updateVehicleStatus={updateVehicleStatus}
                                grantEmergencyPass={grantEmergencyPass}
                            />
                        ) : (
                            <>
                                {searchResults.length > 0 && (
                                    <div className="glass-card" style={{ padding: 20 }}>
                                        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12 }}>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {searchResults.map(v => (
                                                <button key={v.id} onClick={() => viewVehicleDetails(v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${v.isInside ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer', transition: 'all 0.2s', width: '100%', textAlign: 'left', color: 'white' }}
                                                    onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'}
                                                    onMouseOut={e => e.currentTarget.style.borderColor = v.isInside ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        {v.vehicle_type === 'two_wheeler' ? <Bike size={18} color="#818cf8" /> : <CarFront size={18} color="#f59e0b" />}
                                                        <div>
                                                            <div style={{ fontWeight: 700, fontSize: '0.88rem', letterSpacing: '0.04em', display: 'flex', alignItems: 'center' }}>
                                                                {v.vehicle_number}
                                                                {(v.wrong_zone_parkings > 0) && (
                                                                    <span style={{ marginLeft: 8, color: '#f59e0b', fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                                        <AlertTriangle size={10} /> {v.wrong_zone_parkings} Violation{v.wrong_zone_parkings !== 1 ? 's' : ''}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                                {v.parkease_profiles?.full_name}
                                                                {v.parkease_profiles?.enrollment_id && ` • ${v.parkease_profiles.enrollment_id}`}
                                                                {v.parkease_profiles?.department && ` • ${v.parkease_profiles.department}`}
                                                            </div>
                                                            {v.isInside && v.currentZone && (
                                                                <div style={{ fontSize: '0.68rem', color: '#10b981', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                    <MapPin size={10} /> {v.currentZone}
                                                                    {v.currentEntryTime && ` • since ${new Date(v.currentEntryTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                        {v.isInside && (
                                                            <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>🟢 Inside</span>
                                                        )}
                                                        <span className={`badge ${v.status === 'active' ? 'badge-success' : v.status === 'pending_approval' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.65rem' }}>
                                                            {v.status === 'pending_approval' ? 'Pending' : v.status}
                                                        </span>
                                                        <Eye size={14} color="#64748b" />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {searchResults.length === 0 && searchQuery && !searchLoading && (
                                    <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
                                        <Search size={32} color="#334155" style={{ marginBottom: 12 }} />
                                        <p style={{ color: '#64748b' }}>No results found for "{searchQuery}"</p>
                                    </div>
                                )}
                                {!searchQuery && (
                                    <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
                                        <Search size={32} color="#334155" style={{ marginBottom: 12 }} />
                                        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Enter a search query above to find vehicles or users</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ── VEHICLES ─────────────────────────────────────── */}
                {activeTab === 'vehicles' && (
                    <div className="animate-fade-in">
                        {/* Pending approvals banner */}
                        {allVehicles.filter(v => v.status === 'pending_approval').length > 0 && (
                            <div className="glass-card" style={{ padding: 16, marginBottom: 16, borderLeft: '3px solid #f59e0b' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f59e0b', marginBottom: 10 }}>
                                    ⚠️ {allVehicles.filter(v => v.status === 'pending_approval').length} Pending Approvals
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {allVehicles.filter(v => v.status === 'pending_approval').map(v => (
                                        <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.12)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                {v.vehicle_type === 'two_wheeler' ? <Bike size={15} color="#818cf8" /> : <CarFront size={15} color="#f59e0b" />}
                                                <div>
                                                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{v.vehicle_number}</span>
                                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: 8 }}>{v.parkease_profiles?.full_name}</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button onClick={() => updateVehicleStatus(v.id, 'active')} className="btn btn-success" style={{ padding: '4px 10px', fontSize: '0.7rem' }}>
                                                    <CheckCircle size={12} /> Approve
                                                </button>
                                                <button onClick={() => updateVehicleStatus(v.id, 'blocked')} className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.7rem' }}>
                                                    <XCircle size={12} /> Reject
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* All vehicles */}
                        <div className="glass-card" style={{ padding: 20 }}>
                            <h3 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 14 }}>
                                All Registered Vehicles <span style={{ color: '#64748b', fontWeight: 400 }}>({allVehicles.length})</span>
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {allVehicles.filter(v => v.status !== 'pending_approval').map(v => (
                                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', fontSize: '0.8rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            {v.vehicle_type === 'two_wheeler' ? <Bike size={14} color="#818cf8" /> : <CarFront size={14} color="#f59e0b" />}
                                            <span style={{ fontWeight: 600 }}>{v.vehicle_number}</span>
                                            <span style={{ color: '#64748b', fontSize: '0.72rem' }}>{v.parkease_profiles?.full_name}</span>
                                        </div>
                                        <span className={`badge ${v.status === 'active' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.62rem' }}>{v.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── CAPACITY ─────────────────────────────────────── */}
                {activeTab === 'capacity' && (
                    <div className="animate-fade-in">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                            {capacity.map(zone => {
                                const pct = zone.occupancy_percent || 0
                                const color = getCapacityColor(pct)
                                return (
                                    <div key={zone.zone_id} className="glass-card" style={{ padding: 20 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>{zone.zone_name}</div>
                                                <span className={`badge ${zone.vehicle_type === 'two_wheeler' ? 'badge-info' : 'badge-warning'}`}>
                                                    {zone.vehicle_type === 'two_wheeler' ? '2-Wheeler' : '4-Wheeler'}
                                                </span>
                                            </div>
                                            <div style={{ width: 52, height: 52, borderRadius: '50%', border: `3px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, color }}>
                                                {pct}%
                                            </div>
                                        </div>
                                        <div className="capacity-bar" style={{ height: 10, marginBottom: 12 }}>
                                            <div className="capacity-bar-fill" style={{ width: `${pct}%`, background: color }} />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-center text-[0.72rem]">
                                            <div><div style={{ fontWeight: 700, fontSize: '1rem' }}>{zone.total_slots}</div><div style={{ color: '#64748b' }}>Total</div></div>
                                            <div><div style={{ fontWeight: 700, fontSize: '1rem', color }}>{zone.occupied_slots}</div><div style={{ color: '#64748b' }}>Occupied</div></div>
                                            <div><div style={{ fontWeight: 700, fontSize: '1rem', color: '#10b981' }}>{zone.available_slots}</div><div style={{ color: '#64748b' }}>Free</div></div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* ── GUEST PASSES ─────────────────────────────────── */}
                {activeTab === 'guests' && (
                    <AdminGuestPassTab
                        adminPassForm={adminPassForm}
                        setAdminPassForm={setAdminPassForm}
                        handleCreateAdminPass={handleCreateAdminPass}
                        adminPassLoading={adminPassLoading}
                        adminPassMsg={adminPassMsg}
                        allGuests={allGuests}
                        downloadQR={downloadQR}
                        handleCancelPass={handleCancelPass}
                        handleExtendTime={handleExtendTime}
                    />
                )}

                {/* ── ZONES ───────────────────────────────────────── */}
                {activeTab === 'zones' && (
                    <AdminZonesTab />
                )}

                {/* ── ADD GUARD ────────────────────────────────────── */}
                {activeTab === 'guards' && (
                    <AddGuardForm
                        guardForm={guardForm}
                        setGuardForm={setGuardForm}
                        handleCreateGuard={handleCreateGuard}
                        guardLoading={guardLoading}
                        guardMessage={guardMessage}
                    />
                )}
            </div>
        </div>
    )
}
