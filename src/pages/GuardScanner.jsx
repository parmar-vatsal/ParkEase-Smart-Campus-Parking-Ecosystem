import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Html5Qrcode } from 'html5-qrcode'
import {
    ScanLine, Search, ArrowDownCircle, ArrowUpCircle, User, Car, Phone,
    MapPin, Clock, CheckCircle, XCircle, AlertTriangle, Bike, CarFront,
    Camera, X, RefreshCw
} from 'lucide-react'

import VehicleInfo from '../components/guard/VehicleInfo'
import GuestInfo from '../components/guard/GuestInfo'
import CapacityWidget from '../components/guard/CapacityWidget'
import OverstayPanel from '../components/guard/OverstayPanel'
import PendingWalkins from '../components/guard/PendingWalkins'

export default function GuardScanner() {
    const { profile } = useAuth()
    const [scanning, setScanning] = useState(false)
    const [scanResult, setScanResult] = useState(null)
    const [resultType, setResultType] = useState(null) // 'entry', 'exit', 'error'
    const [capacity, setCapacity] = useState([])
    const [manualSearch, setManualSearch] = useState('')
    const [searchLoading, setSearchLoading] = useState(false)
    const [zones, setZones] = useState([])
    const [recentLogs, setRecentLogs] = useState([])
    const [pendingWalkins, setPendingWalkins] = useState([])
    const [activeTab, setActiveTab] = useState('scanner') // 'scanner' or 'lookup'
    const [lookupSearch, setLookupSearch] = useState('')
    const [lookupResult, setLookupResult] = useState(null)
    const [lookupLoading, setLookupLoading] = useState(false)
    const [overstayGuests, setOverstayGuests] = useState([])

    const html5QrRef = useRef(null)          // QR scanner instance

    useEffect(() => {
        fetchCapacity()
        fetchZones()
        fetchRecentLogs()
        fetchPendingWalkins()
        fetchOverstayGuests()
        const interval = setInterval(() => {
            fetchCapacity()
            fetchPendingWalkins()
            fetchOverstayGuests()
        }, 30000)
        return () => {
            clearInterval(interval)
            stopScanner()
        }
    }, [])

    // Helper function to get default zone for guests if needed
    const getDefaultZone = () => zones.length > 0 ? zones[0].id : null;

    const fetchPendingWalkins = async () => {
        const { data } = await supabase
            .from('parkease_guest_passes')
            .select('*')
            .eq('status', 'pending_approval')
            .order('created_at', { ascending: true })
        setPendingWalkins(data || [])
    }

    const fetchOverstayGuests = async () => {
        // Guests who are still 'active' but their valid_until time has passed
        const now = new Date().toISOString()
        const { data } = await supabase
            .from('parkease_guest_passes')
            .select('*')
            .eq('status', 'active')
            .lt('valid_until', now)
            .order('valid_until', { ascending: true })
        setOverstayGuests(data || [])
    }

    const fetchCapacity = async () => {
        const { data: zonesData } = await supabase.from('parkease_zones').select('*').eq('status', 'active').order('name')
        const { data: activeLogs } = await supabase.from('parkease_logs').select('zone_id, vehicle_id, vehicle_number, parkease_vehicles(vehicle_type)').eq('status', 'inside')
        
        // Fetch active guest passes to determine their vehicle types
        const { data: activeGuests } = await supabase.from('parkease_guest_passes').select('vehicle_number, vehicle_type').eq('status', 'active')
        const guestTypeMap = {}
        if (activeGuests) {
            activeGuests.forEach(g => {
                guestTypeMap[g.vehicle_number] = g.vehicle_type
            })
        }

        const rows = []
        for (const zone of (zonesData || [])) {
            const i2 = (activeLogs || []).filter(l => {
                if (l.zone_id !== zone.id) return false;
                if (l.parkease_vehicles?.vehicle_type) return l.parkease_vehicles.vehicle_type === 'two_wheeler';
                return guestTypeMap[l.vehicle_number] === 'two_wheeler';
            }).length;
            
            const i4 = (activeLogs || []).filter(l => {
                if (l.zone_id !== zone.id) return false;
                if (l.parkease_vehicles?.vehicle_type) return l.parkease_vehicles.vehicle_type === 'four_wheeler';
                return guestTypeMap[l.vehicle_number] === 'four_wheeler';
            }).length;
            
            if (zone.capacity_2w_total > 0) { const t = zone.capacity_2w_total + (zone.capacity_2w_overflow || 0); rows.push({ zone_id: zone.id, zone_name: zone.name, vehicle_type: 'two_wheeler', total_slots: t, available_slots: Math.max(0, t - i2), occupancy_percent: t > 0 ? Math.round((i2 / t) * 100) : 0 }) }
            if (zone.capacity_4w_total > 0) { const t = zone.capacity_4w_total + (zone.capacity_4w_overflow || 0); rows.push({ zone_id: zone.id, zone_name: zone.name, vehicle_type: 'four_wheeler', total_slots: t, available_slots: Math.max(0, t - i4), occupancy_percent: t > 0 ? Math.round((i4 / t) * 100) : 0 }) }
        }
        setCapacity(rows)
    }

    const fetchZones = async () => {
        const { data } = await supabase.from('parkease_zones').select('*')
        setZones(data || [])
    }

    const fetchRecentLogs = async () => {
        const { data } = await supabase
            .from('parkease_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10)
        setRecentLogs(data || [])
    }

    const startScanner = async (elementId = 'qr-reader') => {
        setScanning(true)
        setScanResult(null)
        try {
            // Create a fresh Html5Qrcode instance bound to the correct DOM element.
            // The Scanner tab uses 'qr-reader', the Lookup tab uses 'qr-reader-lookup'.
            const html5Qr = new Html5Qrcode(elementId)
            html5QrRef.current = html5Qr

            // IMPORTANT: We always use { facingMode: 'environment' } directly.
            // Calling Html5Qrcode.getCameras() requires an extra permission step on some
            // browsers and can fail or throw, causing a false "access denied" path.
            await html5Qr.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    handleScan(decodedText)
                    html5Qr.stop().catch(() => {})
                    html5QrRef.current = null
                    setScanning(false)
                },
                () => {} // Ignore per-frame QR decode errors
            )
        } catch (err) {
            console.error('QR Scanner error:', err)
            setScanning(false)
            setScanResult({ error: `Camera Error: ${err?.message || 'Could not start camera. Check permissions.'}` })
            setResultType('error')
        }
    }

    const stopScanner = () => {
        if (html5QrRef.current) {
            html5QrRef.current.stop().catch(() => {})
            html5QrRef.current = null
        }
        setScanning(false)
    }

    // --------------------

    const handleScan = async (scannedText) => {
        setSearchLoading(true)
        try {
            // Check if it's a Guest Pass JSON QR
            if (scannedText.startsWith('{') && scannedText.includes('GUEST')) {
                try {
                    const parsed = JSON.parse(scannedText)
                    if (parsed.type === 'GUEST') {
                        const res = await processGuest(scannedText, 'qr_scan')
                        if (res?.error) {
                            setScanResult({ error: res.error })
                            setResultType('error')
                        }
                        setSearchLoading(false)
                        return
                    }
                } catch (e) {
                    console.log("Failed to parse guest JSON", e)
                }
            }

            // 1. Try fetching as a legacy vehicle ID directly
            const { data: vehicle, error: vehicleCountErr } = await supabase
                .from('parkease_vehicles')
                .select('id')
                .eq('id', scannedText)
                .maybeSingle()

            if (vehicle) {
                await processVehicle(scannedText, 'qr_scan')
                setSearchLoading(false)
                return
            }

            // 2. Otherwise assume it's a new unified Profile ID
            const { data: profileVehicles, error: profileErr } = await supabase
                .from('parkease_vehicles')
                .select('*, parkease_profiles(*)')
                .eq('owner_id', scannedText)

            if (profileVehicles && profileVehicles.length > 0) {
                await processProfileVehicles(profileVehicles, 'qr_scan')
            } else {
                setScanResult({ error: 'No vehicles or user found for this QR code.' })
                setResultType('error')
            }
        } catch (err) {
            setScanResult({ error: 'Invalid QR Code scanned.' })
            setResultType('error')
        }
        setSearchLoading(false)
    }

    const processGuest = async (identifier, mode, autoConfirm = false) => {
        // identifier can be qr_code_token (JSON string) or otp_code (6 digits)
        const columnMap = identifier.length === 6 && !isNaN(identifier) ? 'otp_code' : 'qr_code_token'

        const { data: pass } = await supabase
            .from('parkease_guest_passes')
            .select('*, parkease_profiles(*)') // gets sponsor details
            .eq(columnMap, identifier)
            .single()

        if (!pass) {
            // We RETURN the error string rather than setting state directly here so manualSearch can decide
            return { error: 'Invalid Guest Pass or OTP.' }
        }

        if (pass.status === 'cancelled') {
            setScanResult({ guestPass: pass, error: '❌ Canceled: Sponsor canceled this pass.' })
            setResultType('error')
            return { handled: true }
        }

        const now = new Date()
        const expiry = new Date(pass.valid_until)

        // STAGED Exit Flow: Even if expired, let them exit
        if (pass.status === 'active') {
            const entryTime = new Date(pass.entry_time)
            const durationMin = Math.round((now - entryTime) / 60000)

            const { data: logOptions } = await supabase
                .from('parkease_logs')
                .select('id, zone_id')
                .eq('vehicle_number', pass.vehicle_number)
                .eq('status', 'inside')
                .limit(1)

            let zoneName = 'Unknown'
            let activeLogId = null
            if (logOptions && logOptions.length > 0) {
                activeLogId = logOptions[0].id
                zoneName = zones.find(z => z.id === logOptions[0].zone_id)?.name || 'Unknown'
            }

            const stagedScanObj = {
                guestPass: pass,
                stagedAction: 'exit',
                duration: durationMin,
                entryTime: pass.entry_time,
                zone: zoneName,
                isExpired: now > expiry,
                activeLogId
            }

            setScanResult(stagedScanObj)
            setResultType('staged')

            if (autoConfirm) {
                // Must manually build the current state since confirmAction depends on `scanResult` state which hasn't flushed yet
                await executeConfirmAction(stagedScanObj, 'exit')
            }
        }
        else if (pass.status === 'pending' || pass.status === 'pending_approval') {
            // STAGED Entry Flow
            if (now > expiry) {
                setScanResult({ guestPass: pass, error: '❌ Pass Expired. Valid until ' + expiry.toLocaleTimeString() })
                setResultType('error')
                return { handled: true }
            }

            const activeZoneForGuest = getDefaultZone()
            if (!activeZoneForGuest) {
                setScanResult({ guestPass: pass, error: 'System Error: No valid Zones available for guest parking.' })
                setResultType('error')
                return { handled: true }
            }

            const stagedScanObj = {
                guestPass: pass,
                stagedAction: 'entry',
                zone: zones.find(z => z.id === activeZoneForGuest)?.name || 'Guest Zone',
                zoneId: activeZoneForGuest,
                mode
            }

            setScanResult(stagedScanObj)
            setResultType('staged')

            if (autoConfirm) {
                await executeConfirmAction(stagedScanObj, 'entry')
            }
        }
        else if (pass.status === 'exited') {
            setScanResult({ guestPass: pass, error: '❌ Single-Use Pass Already Exited.' })
            setResultType('error')
            return { handled: true }
        }

        fetchCapacity()
        fetchRecentLogs()
        fetchPendingWalkins()
        setManualSearch('')
        return { handled: true }
    }

    const handleApproveWalkIn = async (pass) => {
        setManualSearch(pass.otp_code)
        await processGuest(pass.otp_code, 'walkin_approval')
    }

    const handleRejectWalkIn = async (passId) => {
        if (!confirm('Reject this walk-in entry?')) return
        await supabase.from('parkease_guest_passes').update({ status: 'cancelled' }).eq('id', passId)
        fetchPendingWalkins()
    }

    const handleManualSearch = async (e, directTerm = null, autoConfirm = false) => {
        if (e && e.preventDefault) e.preventDefault()

        const term = directTerm || manualSearch.trim()
        if (!term) return

        setSearchLoading(true)

        // If exactly 6 digits, it might be a Guest Pass OTP
        if (term.length === 6 && /^\d+$/.test(term)) {
            await processGuest(term, 'manual_entry', autoConfirm)
            // If it processed properly or threw an explicit guest error, we should stop.
            if (scanResult && scanResult.error && scanResult.error === 'Invalid Guest Pass or OTP.') {
                // Do nothing, let it fall through to vehicle search
            } else {
                setSearchLoading(false)
                return
            }
        }

        // Search by vehicle number
        const { data: vehicles } = await supabase
            .from('parkease_vehicles')
            .select('*, parkease_profiles(*)')
            .ilike('vehicle_number', `%${term}%`)
            .limit(5)

        if (vehicles && vehicles.length === 1) {
            await processVehicle(vehicles[0].id, 'manual_entry', autoConfirm)
        } else if (vehicles && vehicles.length > 1) {
            setScanResult({ vehicles, multiple: true })
            setResultType('multiple')
        } else {
            // Try searching by enrollment/phone
            const { data: profiles } = await supabase
                .from('parkease_profiles')
                .select('*')
                .or(`enrollment_id.ilike.%${term}%,phone.ilike.%${term}%`)
                .limit(5)

            if (profiles && profiles.length > 0) {
                const profileIds = profiles.map(p => p.id)
                const { data: profileVehicles } = await supabase
                    .from('parkease_vehicles')
                    .select('*, parkease_profiles(*)')
                    .in('owner_id', profileIds)

                if (profileVehicles?.length > 0) {
                    await processProfileVehicles(profileVehicles, 'manual_entry', autoConfirm)
                } else {
                    setScanResult({ error: 'No vehicles found for this search.' })
                    setResultType('error')
                }
            } else {
                setScanResult({ error: 'No vehicle or user found.' })
                setResultType('error')
            }
        }
        setSearchLoading(false)
    }

    const processProfileVehicles = async (profileVehicles, mode, autoConfirm = false) => {
        if (!profileVehicles || profileVehicles.length === 0) {
            setScanResult({ error: 'No vehicles found.' })
            setResultType('error')
            return
        }

        const vIds = profileVehicles.map(v => v.id)
        const { data: activeLogs } = await supabase
            .from('parkease_logs')
            .select('*')
            .in('vehicle_id', vIds)
            .eq('status', 'inside')

        // If there's exactly 1 vehicle inside from this list, assume they want to EXIT that one!
        if (activeLogs && activeLogs.length === 1) {
            await processVehicle(activeLogs[0].vehicle_id, mode, autoConfirm)
            return
        }

        // Otherwise, if they just have 1 vehicle total, process it
        if (profileVehicles.length === 1) {
            await processVehicle(profileVehicles[0].id, mode, autoConfirm)
        } else {
            // Ask them to select which one
            setScanResult({ vehicles: profileVehicles, multiple: true })
            setResultType('multiple')
        }
    }

    const processVehicle = async (vehicleId, mode, autoConfirm = false) => {
        // Fetch vehicle with owner
        const { data: vehicle } = await supabase
            .from('parkease_vehicles')
            .select('*, parkease_profiles(*)')
            .eq('id', vehicleId)
            .single()

        if (!vehicle) {
            setScanResult({ error: 'Vehicle not found in system.' })
            setResultType('error')
            return
        }

        if (vehicle.status === 'blocked') {
            setScanResult({ vehicle, error: '🚫 BLOCKED: This vehicle has been blocked.' })
            setResultType('error')
            return
        }

        if (vehicle.status !== 'active') {
            setScanResult({ vehicle, error: '⚠️ Vehicle registration is not active.' })
            setResultType('error')
            return
        }

        // Check if vehicle is currently inside
        const { data: activeLogs } = await supabase
            .from('parkease_logs')
            .select('*')
            .eq('vehicle_id', vehicleId)
            .eq('status', 'inside')
            .limit(1)

        if (activeLogs && activeLogs.length > 0) {
            // STAGED EXIT flow
            const log = activeLogs[0]
            const entryTime = new Date(log.entry_time)
            const now = new Date()
            const durationMin = Math.round((now - entryTime) / 60000)

            const stagedScanObj = {
                vehicle,
                stagedAction: 'exit',
                duration: durationMin,
                entryTime: log.entry_time,
                zone: zones.find(z => z.id === log.zone_id)?.name || 'Unknown',
                activeLogId: log.id
            }

            setScanResult(stagedScanObj)
            setResultType('staged')

            if (autoConfirm) {
                await executeConfirmAction(stagedScanObj, 'exit')
            }
        } else {
            // STAGED ENTRY flow

            // Phase 6 Check: Ensure User doesn't already have another vehicle parked inside
            const { data: userActiveLogs } = await supabase
                .from('parkease_logs')
                .select('*')
                .eq('user_id', vehicle.owner_id)
                .eq('status', 'inside')
                .limit(1)

            if (userActiveLogs && userActiveLogs.length > 0) {
                setScanResult({
                    vehicle,
                    error: `🛑 Access Denied: This user already has a vehicle (${userActiveLogs[0].vehicle_number}) parked inside.`
                })
                setResultType('error')
                return { handled: true }
            }

            const targetZoneId = vehicle.allocated_zone_id
            if (!targetZoneId) {
                setScanResult({ vehicle, error: 'No Zone Allocated: Cannot allow entry because vehicle has no allocated zone.' })
                setResultType('error')
                return { handled: true }
            }

            const stagedScanObj = {
                vehicle,
                stagedAction: 'entry',
                zone: zones.find(z => z.id === targetZoneId)?.name || 'Designated Zone',
                zoneId: targetZoneId,
                mode,
                wrongZone: false // Forced parking to allocated zone, so never "wrong"
            }

            setScanResult(stagedScanObj)
            setResultType('staged')

            if (autoConfirm) {
                await executeConfirmAction(stagedScanObj, 'entry')
            }
        }
        setManualSearch('')
    }

    const executeConfirmAction = async (scanObj, explicitAction) => {
        // Helper function for autoConfirm to skip state dependency
        try {
            if (explicitAction === 'entry') {
                if (scanObj.vehicle) {
                    const { error } = await supabase.from('parkease_logs').insert({
                        vehicle_id: scanObj.vehicle.id,
                        user_id: scanObj.vehicle.owner_id,
                        vehicle_number: scanObj.vehicle.vehicle_number,
                        zone_id: scanObj.zoneId,
                        guard_id: profile.id,
                        status: 'inside',
                        entry_mode: scanObj.mode,
                        allocated_zone_id: scanObj.vehicle.allocated_zone_id || null,
                        actual_zone_id: scanObj.zoneId,
                        is_correct_zone: !scanObj.wrongZone,
                        zone_violation: scanObj.wrongZone || false,
                    })
                    if (error) throw error

                    // If they parked in the wrong zone, increment their penalty counter
                    if (scanObj.wrongZone) {
                        await supabase.rpc('increment_wrong_zone', { v_id: scanObj.vehicle.id }).catch(() => {
                           // Silently fail if RPC doesn't exist yet, fallback to a standard JS update if necessary, but standard JS update might hit RLS or race conditions. For now, doing standard update.
                           supabase
                             .from('parkease_vehicles')
                             .select('wrong_zone_parkings')
                             .eq('id', scanObj.vehicle.id)
                             .single()
                             .then(({ data }) => {
                                 if (data) {
                                     supabase.from('parkease_vehicles')
                                     .update({ wrong_zone_parkings: (data.wrong_zone_parkings || 0) + 1 })
                                     .eq('id', scanObj.vehicle.id)
                                     .then()
                                 }
                             });
                        });
                    }

                    setScanResult({ ...scanObj, action: 'entry' })
                    setResultType('entry')
                } else if (scanObj.guestPass) {
                    const pass = scanObj.guestPass
                    await supabase.from('parkease_guest_passes').update({ status: 'active', entry_time: new Date().toISOString(), entry_count: pass.entry_count + 1 }).eq('id', pass.id)
                    await supabase.from('parkease_logs').insert({
                        user_id: pass.sponsor_id,
                        vehicle_number: pass.vehicle_number,
                        zone_id: scanObj.zoneId,
                        guard_id: profile.id,
                        status: 'inside',
                        entry_mode: scanObj.mode,
                    })
                    setScanResult({ ...scanObj, action: 'entry' })
                    setResultType('entry')
                }
            } else if (explicitAction === 'exit') {
                const now = new Date().toISOString()
                if (scanObj.vehicle) {
                    await supabase.from('parkease_logs').update({ exit_time: now, status: 'exited', duration_minutes: scanObj.duration }).eq('id', scanObj.activeLogId)
                    setScanResult({ ...scanObj, action: 'exit' })
                    setResultType('exit')
                } else if (scanObj.guestPass) {
                    const pass = scanObj.guestPass
                    await supabase.from('parkease_guest_passes').update({ status: 'exited', exit_time: now }).eq('id', pass.id)
                    if (scanObj.activeLogId) {
                        await supabase.from('parkease_logs').update({ exit_time: now, status: 'exited', duration_minutes: scanObj.duration }).eq('id', scanObj.activeLogId)
                    }
                    setScanResult({ ...scanObj, action: 'exit' })
                    setResultType('exit')
                }
            }

            fetchCapacity()
            fetchRecentLogs()
            fetchPendingWalkins()
            fetchOverstayGuests()
        } catch (err) {
            setScanResult({ error: err.message })
            setResultType('error')
        }
    }

    const confirmAction = async () => {
        if (!scanResult) return
        await executeConfirmAction(scanResult, scanResult.stagedAction)
    }

    const handleLookupSearch = async (e, directTerm = null) => {
        if (e && e.preventDefault) e.preventDefault()

        const term = directTerm || lookupSearch.trim()
        if (!term) return

        setLookupLoading(true)
        setLookupResult(null)

        // 1. Check if it's a 6-digit OTP for a Guest Pass
        if (term.length === 6 && /^\d+$/.test(term)) {
            const { data: pass } = await supabase
                .from('parkease_guest_passes')
                .select('*, parkease_profiles(*)')
                .eq('otp_code', term)
                .single()
            if (pass) {
                // Check if inside
                const { data: activeLogs } = await supabase.from('parkease_logs').select('*').eq('vehicle_number', pass.vehicle_number).eq('status', 'inside').limit(1)
                setLookupResult({ type: 'guest', data: pass, isInside: activeLogs && activeLogs.length > 0 })
                setLookupLoading(false)
                return
            }
        }

        // 2. Search Vehicles
        const { data: vehicles } = await supabase
            .from('parkease_vehicles')
            .select('*, parkease_profiles(*)')
            .ilike('vehicle_number', `%${term}%`)
            .limit(5)

        if (vehicles && vehicles.length > 0) {
            // we will need to check isInside for the multiple results later or just fetch all active logs for these vehicles
            const vIds = vehicles.map(v => v.id)
            const { data: activeLogs } = await supabase.from('parkease_logs').select('vehicle_id').in('vehicle_id', vIds).eq('status', 'inside')
            const insideMap = new Set(activeLogs?.map(l => l.vehicle_id) || [])
            setLookupResult({ type: 'vehicles', data: vehicles.map(v => ({ ...v, isInside: insideMap.has(v.id) })) })
            setLookupLoading(false)
            return
        }

        // 3. Search Profiles (Enrollment/Phone)
        const { data: profiles } = await supabase
            .from('parkease_profiles')
            .select('*')
            .or(`enrollment_id.ilike.%${term}%,phone.ilike.%${term}%`)
            .limit(5)

        if (profiles && profiles.length > 0) {
            const profileIds = profiles.map(p => p.id)
            const { data: profileVehicles } = await supabase
                .from('parkease_vehicles')
                .select('*, parkease_profiles(*)')
                .in('owner_id', profileIds)

            if (profileVehicles?.length > 0) {
                const vIds = profileVehicles.map(v => v.id)
                const { data: activeLogs } = await supabase.from('parkease_logs').select('vehicle_id').in('vehicle_id', vIds).eq('status', 'inside')
                const insideMap = new Set(activeLogs?.map(l => l.vehicle_id) || [])
                setLookupResult({ type: 'vehicles', data: profileVehicles.map(v => ({ ...v, isInside: insideMap.has(v.id) })) })
            } else {
                setLookupResult({ error: 'User found, but no vehicles registered.' })
            }
        } else {
            setLookupResult({ error: 'No user, vehicle, or guest pass found.' })
        }

        setLookupLoading(false)
    }

    const formatDuration = (mins) => {
        const h = Math.floor(mins / 60)
        const m = mins % 60
        return h > 0 ? `${h}h ${m}m` : `${m}m`
    }

    return (
        <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 4 }}>
                Guard Scanner
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: 20 }}>
                Scan vehicle QR or search manually
            </p>

            <CapacityWidget capacity={capacity} />

            {/* TAB SELECTOR */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, padding: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 16 }}>
                <button
                    onClick={() => setActiveTab('scanner')}
                    style={{
                        flex: 1, padding: '10px 0', borderRadius: 12, fontWeight: 700, fontSize: '0.9rem',
                        transition: 'all 0.2s', border: 'none', cursor: 'pointer',
                        background: activeTab === 'scanner' ? '#6366f1' : 'transparent',
                        color: activeTab === 'scanner' ? 'white' : '#94a3b8',
                        boxShadow: activeTab === 'scanner' ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none'
                    }}
                >
                    <ScanLine size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                    Scanner Mode
                </button>
                <button
                    onClick={() => { setActiveTab('lookup'); setLookupResult(null); setLookupSearch(''); }}
                    style={{
                        flex: 1, padding: '10px 0', borderRadius: 12, fontWeight: 700, fontSize: '0.9rem',
                        transition: 'all 0.2s', border: 'none', cursor: 'pointer',
                        background: activeTab === 'lookup' ? '#6366f1' : 'transparent',
                        color: activeTab === 'lookup' ? 'white' : '#94a3b8',
                        boxShadow: activeTab === 'lookup' ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none'
                    }}
                >
                    <Search size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                    Directory Lookup
                </button>
            </div>

            {activeTab === 'scanner' && (
                <>
                    {/* Scan Button */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                        {!scanning ? (
                            <button onClick={() => startScanner('qr-reader')} className="btn btn-primary btn-xl" style={{ flex: 1 }}>
                                <Camera size={22} /> Start QR Scanner
                            </button>
                        ) : (
                            <button onClick={stopScanner} className="btn btn-danger btn-xl" style={{ flex: 1 }}>
                                <X size={22} /> Stop Camera
                            </button>
                        )}
                    </div>

                    {/* QR Scanner View */}
                    <div id="qr-reader" style={{
                        display: scanning ? 'block' : 'none',
                        marginBottom: 20, borderRadius: 16, overflow: 'hidden',
                        border: '2px solid rgba(99, 102, 241, 0.3)',
                    }} />

                    {/* Manual Search */}
                    <form onSubmit={handleManualSearch} style={{ marginBottom: 20 }}>
                        <label className="label">Manual Search</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ flex: 1, position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                <input
                                    className="input"
                                    style={{ paddingLeft: 40 }}
                                    placeholder="Vehicle number, phone, or enrollment ID"
                                    value={manualSearch}
                                    onChange={(e) => setManualSearch(e.target.value)}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={searchLoading}>
                                {searchLoading ? <div className="spinner" /> : 'Search'}
                            </button>
                        </div>
                    </form>

                    {/* Scan Result */}
                    {scanResult && (
                        <div className="glass-card animate-fade-in-up" style={{
                            padding: 24, marginBottom: 20,
                            borderLeft: `4px solid ${resultType === 'entry' ? '#10b981' :
                                resultType === 'exit' ? '#818cf8' :
                                    resultType === 'multiple' ? '#f59e0b' : '#f43f5e'
                                }`,
                        }}>
                            {resultType === 'staged' && (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                        <div style={{
                                            width: 44, height: 44, borderRadius: 12,
                                            background: 'rgba(99, 102, 241, 0.15)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {scanResult.stagedAction === 'entry' ? <ArrowDownCircle size={24} color="#6366f1" /> : <ArrowUpCircle size={24} color="#6366f1" />}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, color: '#6366f1', fontSize: '1.1rem' }}>
                                                {scanResult.stagedAction === 'entry' ? 'PENDING ENTRY' : 'PENDING EXIT'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                {scanResult.stagedAction === 'entry' ? `Target Zone: ${scanResult.zone}` : `Duration: ${formatDuration(scanResult.duration)}`}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Removed wrong zone warning since vehicles only park in allocated zone */}

                                    {scanResult.vehicle && <VehicleInfo vehicle={scanResult.vehicle} />}
                                    {scanResult.guestPass && <GuestInfo pass={scanResult.guestPass} action={scanResult.stagedAction} isExpired={scanResult.isExpired} />}

                                    <button onClick={confirmAction} className={`btn ${scanResult.stagedAction === 'entry' ? 'btn-success' : 'btn-primary'}`} style={{ width: '100%', marginTop: 16, padding: '14px 0', fontSize: '1rem' }}>
                                        {scanResult.stagedAction === 'entry' ? (
                                            <><CheckCircle size={18} /> Confirm Check In</>
                                        ) : (
                                            <><CheckCircle size={18} /> Confirm Check Out</>
                                        )}
                                    </button>
                                </div>
                            )}

                            {resultType === 'error' && (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                        <XCircle size={24} color="#f43f5e" />
                                        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f43f5e' }}>
                                            {scanResult.error}
                                        </span>
                                    </div>
                                    {scanResult.vehicle && <VehicleInfo vehicle={scanResult.vehicle} />}
                                    {scanResult.guestPass && <GuestInfo pass={scanResult.guestPass} />}
                                </div>
                            )}

                            {resultType === 'entry' && (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                        <div style={{
                                            width: 44, height: 44, borderRadius: 12,
                                            background: 'rgba(16, 185, 129, 0.15)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <ArrowDownCircle size={24} color="#10b981" />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, color: '#10b981', fontSize: '1.1rem' }}>
                                                ✅ ENTRY ALLOWED
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{scanResult.zone}</div>
                                        </div>
                                    </div>
                                    {scanResult.vehicle && <VehicleInfo vehicle={scanResult.vehicle} />}
                                    {scanResult.guestPass && <GuestInfo pass={scanResult.guestPass} action="entry" />}
                                </div>
                            )}

                            {resultType === 'exit' && (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                        <div style={{
                                            width: 44, height: 44, borderRadius: 12,
                                            background: 'rgba(129, 140, 248, 0.15)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <ArrowUpCircle size={24} color="#818cf8" />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, color: '#818cf8', fontSize: '1.1rem' }}>
                                                🚪 EXIT RECORDED
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                Duration: {formatDuration(scanResult.duration)} • {scanResult.zone}
                                            </div>
                                        </div>
                                    </div>
                                    {scanResult.vehicle && <VehicleInfo vehicle={scanResult.vehicle} />}
                                    {scanResult.guestPass && <GuestInfo pass={scanResult.guestPass} action="exit" isExpired={scanResult.isExpired} />}
                                </div>
                            )}

                            {resultType === 'multiple' && scanResult.vehicles && (
                                <div>
                                    <div style={{ marginBottom: 12, fontWeight: 600, color: '#f59e0b' }}>
                                        {scanResult.vehicles.length} vehicles found — select one:
                                    </div>
                                    {scanResult.vehicles.map(v => (
                                        <button
                                            key={v.id}
                                            onClick={() => processVehicle(v.id, 'manual_entry')}
                                            className="glass-card glass-card-hover"
                                            style={{
                                                width: '100%', padding: 14, marginBottom: 8, textAlign: 'left',
                                                cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)',
                                                background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: 12,
                                            }}
                                        >
                                            {v.vehicle_type === 'two_wheeler' ? <Bike size={18} color="#818cf8" /> : <CarFront size={18} color="#f59e0b" />}
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{v.vehicle_number}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                    {v.parkease_profiles?.full_name} • {v.parkease_profiles?.phone}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            <button onClick={() => { setScanResult(null); setResultType(null) }} className="btn btn-ghost" style={{ marginTop: 12, width: '100%' }}>
                                <RefreshCw size={14} /> Clear & Scan Next
                            </button>
                        </div>
                    )}

                    {/* Recent Activity */}
                    <div className="glass-card" style={{ padding: 20 }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Clock size={16} color="#818cf8" />
                            Recent Activity
                        </h3>
                        {recentLogs.length === 0 ? (
                            <p style={{ color: '#475569', fontSize: '0.8rem', textAlign: 'center', padding: 20 }}>No activity yet today</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {recentLogs.map(log => (
                                    <div key={log.id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)',
                                        fontSize: '0.8rem',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {log.status === 'inside'
                                                ? <ArrowDownCircle size={14} color="#10b981" />
                                                : <ArrowUpCircle size={14} color="#818cf8" />
                                            }
                                            <span style={{ fontWeight: 600 }}>{log.vehicle_number}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span className={`badge ${log.status === 'inside' ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '0.65rem' }}>
                                                {log.status === 'inside' ? 'IN' : 'OUT'}
                                            </span>
                                            <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                                                {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ⚠️ Overstay Alert (Phase 11) */}
                    <OverstayPanel
                        overstayGuests={overstayGuests}
                        setManualSearch={setManualSearch}
                        processGuest={processGuest}
                        setSearchLoading={setSearchLoading}
                    />

                    {/* Pending Walk-ins (Phase 5) */}
                    <PendingWalkins
                        pendingWalkins={pendingWalkins}
                        handleApproveWalkIn={handleApproveWalkIn}
                        handleRejectWalkIn={handleRejectWalkIn}
                    />
                </>
            )}

            {activeTab === 'lookup' && (
                <div className="glass-card animate-fade-in-up" style={{ padding: 24 }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Search size={20} color="#818cf8" />
                        Campus Directory Lookup
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: 20 }}>
                        Passively search for vehicle owners or guests without recording entry/exit logs.
                    </p>

                    <form onSubmit={handleLookupSearch} style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ flex: 1, position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                <input
                                    className="input"
                                    style={{ paddingLeft: 40 }}
                                    placeholder="Vehicle # (GJ05...), Phone, or Enrollment ID"
                                    value={lookupSearch}
                                    onChange={(e) => setLookupSearch(e.target.value)}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={lookupLoading}>
                                {lookupLoading ? <div className="spinner" /> : 'Lookup'}
                            </button>
                        </div>
                    </form>

                    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                        {!scanning ? (
                            <button onClick={() => startScanner('qr-reader-lookup')} className="btn btn-primary btn-xl" style={{ flex: 1 }}>
                                <Camera size={22} /> Start QR Scanner
                            </button>
                        ) : (
                            <button onClick={stopScanner} className="btn btn-danger btn-xl" style={{ flex: 1 }}>
                                <X size={22} /> Stop Camera
                            </button>
                        )}
                    </div>

                    {/* QR Scanner View */}
                    <div id="qr-reader-lookup" style={{
                        display: scanning ? 'block' : 'none',
                        marginBottom: 20, borderRadius: 16, overflow: 'hidden',
                        border: '2px solid rgba(99, 102, 241, 0.3)',
                    }} />

                    {lookupResult && (
                        <div style={{ marginTop: 20 }}>
                            {lookupResult.error && (
                                <div style={{ padding: 16, background: 'rgba(244,63,94,0.1)', borderRadius: 12, border: '1px solid rgba(244,63,94,0.2)', color: '#f43f5e', fontWeight: 600 }}>
                                    <XCircle size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
                                    {lookupResult.error}
                                </div>
                            )}

                            {lookupResult.type === 'guest' && lookupResult.data && (
                                <div>
                                    <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontWeight: 700 }}>🔍 Guest Result</span>
                                        <span className={`badge ${lookupResult.isInside ? 'badge-success' : 'badge-ghost'}`}>
                                            {lookupResult.isInside ? '🟢 CURRENTLY INSIDE' : '⚫ NOT INSIDE'}
                                        </span>
                                    </div>
                                    <GuestInfo pass={lookupResult.data} />
                                </div>
                            )}

                            {lookupResult.type === 'vehicles' && lookupResult.data && lookupResult.data.length > 0 && (
                                <div>
                                    <div style={{ marginBottom: 12, fontWeight: 700 }}>
                                        🔍 Found {lookupResult.data.length} vehicle(s):
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {lookupResult.data.map(v => (
                                            <div key={v.id} style={{ position: 'relative' }}>
                                                <VehicleInfo vehicle={v} />
                                                <div style={{ position: 'absolute', top: 16, right: 16 }}>
                                                    <span className={`badge ${v.isInside ? 'badge-success' : 'badge-ghost'}`}>
                                                        {v.isInside ? '🟢 INSIDE CAMPUS' : '⚫ NOT INSIDE'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
