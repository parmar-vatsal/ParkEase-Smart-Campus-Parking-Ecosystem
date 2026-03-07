import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Html5Qrcode } from 'html5-qrcode'
import { createWorker } from 'tesseract.js'
import {
    ScanLine, Search, ArrowDownCircle, ArrowUpCircle, User, Car, Phone,
    MapPin, Clock, CheckCircle, XCircle, AlertTriangle, Bike, CarFront,
    Camera, X, RefreshCw, Check, Bell, Type
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
    const [selectedZone, setSelectedZone] = useState('')
    const [zones, setZones] = useState([])
    const [recentLogs, setRecentLogs] = useState([])
    const [pendingWalkins, setPendingWalkins] = useState([])
    const [activeTab, setActiveTab] = useState('scanner') // 'scanner' or 'lookup'
    const [lookupSearch, setLookupSearch] = useState('')
    const [lookupResult, setLookupResult] = useState(null)
    const [lookupLoading, setLookupLoading] = useState(false)
    const [overstayGuests, setOverstayGuests] = useState([])
    const [scannerMode, setScannerMode] = useState('qr') // 'qr' or 'anpr'
    const [anprLoading, setAnprLoading] = useState(false)

    const scannerRef = useRef(null)
    const html5QrRef = useRef(null)
    const videoRef = useRef(null)
    const streamRef = useRef(null)
    const canvasRef = useRef(null)

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
        }, 30000) // Refresh every 30s so guard sees new overstays
        return () => {
            clearInterval(interval)
            stopScanner()
            stopAnprCamera()
        }
    }, [])

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
        const { data } = await supabase.from('parkease_capacity').select('*')
        setCapacity(data || [])
    }

    const fetchZones = async () => {
        const { data } = await supabase.from('parkease_zones').select('*')
        setZones(data || [])
        if (data?.length > 0 && !selectedZone) setSelectedZone(data[0].id)
    }

    const fetchRecentLogs = async () => {
        const { data } = await supabase
            .from('parkease_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10)
        setRecentLogs(data || [])
    }

    const startScanner = async () => {
        setScanning(true)
        setScanResult(null)
        try {
            const html5Qr = new Html5Qrcode('qr-reader')
            html5QrRef.current = html5Qr

            // Camera selection logic to avoid ultra-wide lenses on modern phones
            let cameraConfig = { facingMode: 'environment' }
            try {
                const devices = await Html5Qrcode.getCameras()
                if (devices && devices.length > 0) {
                    const backCameras = devices.filter(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('rear') || c.label.toLowerCase().includes('environment'))
                    // Filter out keywords indicating ultra-wide lenses
                    const normalCameras = backCameras.filter(c => !c.label.toLowerCase().includes('ultra') && !c.label.toLowerCase().includes('wide') && !c.label.toLowerCase().includes('0.5'))

                    if (normalCameras.length > 0) {
                        cameraConfig = normalCameras[normalCameras.length - 1].id // Usually the final "back" camera without ultra/wide is the main one, or the first. Let's just pick the first normal one.
                        cameraConfig = normalCameras[0].id
                    } else if (backCameras.length > 0) {
                        cameraConfig = backCameras[0].id
                    } else if (devices.length > 0 && devices[0].id) {
                        // Fallback to the very first device explicitly rather than facingMode if available
                        // Wait, no, facingMode is safer if label parsing completely fails
                    }
                }
            } catch (camErr) {
                console.warn('Failed to enumerate cameras, falling back to environment mode', camErr)
            }

            await html5Qr.start(
                cameraConfig,
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    handleScan(decodedText)
                    html5Qr.stop().catch(() => { })
                    setScanning(false)
                },
                () => { } // ignore errors
            )
        } catch (err) {
            setScanning(false)
            setScanResult({ error: 'Camera access denied. Use manual search.' })
            setResultType('error')
        }
    }

    const stopScanner = () => {
        if (html5QrRef.current) {
            html5QrRef.current.stop().catch(() => { })
            html5QrRef.current = null
        }
        setScanning(false)
    }

    // --- ANPR Methods ---

    const startAnprCamera = async () => {
        setScannerMode('anpr')
        setScanning(true)
        setScanResult(null)

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            })
            if (videoRef.current) {
                videoRef.current.srcObject = stream
            }
            streamRef.current = stream
        } catch (err) {
            console.error('ANPR Camera Error', err)
            setScanning(false)
            setScannerMode('qr')
            setScanResult({ error: 'Failed to access camera for ANPR.' })
            setResultType('error')
        }
    }

    const stopAnprCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null
        }
        setScanning(false)
    }

    const switchMode = async (mode) => {
        if (scanning) {
            if (scannerMode === 'qr') stopScanner()
            if (scannerMode === 'anpr') stopAnprCamera()
        }

        setScanResult(null)
        setManualSearch('')
        setScannerMode(mode)

        if (scanning) {
            if (mode === 'qr') startScanner()
            if (mode === 'anpr') startAnprCamera()
        }
    }

    const captureAndProcessAnpr = async () => {
        if (!videoRef.current || !canvasRef.current) return
        setAnprLoading(true)

        try {
            const video = videoRef.current
            const canvas = canvasRef.current

            // Set canvas to actual video dimensions
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight

            const ctx = canvas.getContext('2d')
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

            const imageData = canvas.toDataURL('image/jpeg', 0.8)

            // Temporary stop camera so it freezes on the captured frame
            stopAnprCamera()

            const worker = await createWorker('eng')
            const { data: { text } } = await worker.recognize(imageData)
            await worker.terminate()

            // Parse for potential license plate: Remove spaces/special characters, grab uppercase and numbers
            // We just extract alphanumeric characters. Let the guard correct minor issues.
            const rawPlate = text.replace(/[^A-Z0-9]/gi, '').toUpperCase()

            if (rawPlate.length >= 4) { // Minimum length for a typical plate
                setManualSearch(rawPlate)
                // Fake an event object to pass to handleManualSearch
                handleManualSearch({ preventDefault: () => { } }, rawPlate)
            } else {
                setScanResult({ error: 'Could not read a valid license plate from the image. Please try again or type manually.' })
                setResultType('error')
            }

        } catch (err) {
            console.error('OCR Error', err)
            setScanResult({ error: 'Failed to process image for license plates.' })
            setResultType('error')
        } finally {
            setAnprLoading(false)
        }
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

    const processGuest = async (identifier, mode) => {
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

            setScanResult({
                guestPass: pass,
                stagedAction: 'exit',
                duration: durationMin,
                entryTime: pass.entry_time,
                zone: zoneName,
                isExpired: now > expiry,
                activeLogId
            })
            setResultType('staged')
        }
        else if (pass.status === 'pending' || pass.status === 'pending_approval') {
            // STAGED Entry Flow
            if (now > expiry) {
                setScanResult({ guestPass: pass, error: '❌ Pass Expired. Valid until ' + expiry.toLocaleTimeString() })
                setResultType('error')
                return { handled: true }
            }

            if (!selectedZone) {
                setScanResult({ guestPass: pass, error: 'Please select an Entry Zone first.' })
                setResultType('error')
                return { handled: true }
            }

            setScanResult({
                guestPass: pass,
                stagedAction: 'entry',
                zone: zones.find(z => z.id === selectedZone)?.name || 'Selected Zone',
                zoneId: selectedZone,
                mode
            })
            setResultType('staged')
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

    const handleManualSearch = async (e, directTerm = null) => {
        if (e && e.preventDefault) e.preventDefault()

        const term = directTerm || manualSearch.trim()
        if (!term) return

        setSearchLoading(true)

        // If exactly 6 digits, it might be a Guest Pass OTP
        if (term.length === 6 && /^\d+$/.test(term)) {
            await processGuest(term, 'manual_entry')
            // If it processed properly or threw an explicit guest error, we should stop.
            // But if it was literally just "not found" as a guest, maybe it is a 6-digit enrollment ID.
            if (scanResult && scanResult.error && scanResult.error === 'Invalid Guest Pass or OTP.') {
                // Do nothing, let it fall through to vehicle search just in case
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
            await processVehicle(vehicles[0].id, 'manual_entry')
        } else if (vehicles && vehicles.length > 1) {
            // Show multiple results
            setScanResult({ vehicles, multiple: true })
            setResultType('multiple')
        } else {
            // Try searching by enrollment/phone
            const { data: profiles } = await supabase
                .from('parkease_profiles')
                .select('*')
                .or(`enrollment_id.ilike.%${manualSearch.trim()}%,phone.ilike.%${manualSearch.trim()}%`)
                .limit(5)

            if (profiles && profiles.length > 0) {
                const profileIds = profiles.map(p => p.id)
                const { data: profileVehicles } = await supabase
                    .from('parkease_vehicles')
                    .select('*, parkease_profiles(*)')
                    .in('owner_id', profileIds)

                if (profileVehicles?.length > 0) {
                    await processProfileVehicles(profileVehicles, 'manual_entry')
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

    const processProfileVehicles = async (profileVehicles, mode) => {
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
        // This solves the issue where users with multiple vehicles have to select which one to exit.
        if (activeLogs && activeLogs.length === 1) {
            await processVehicle(activeLogs[0].vehicle_id, mode)
            return
        }

        // Otherwise, if they just have 1 vehicle total, process it
        if (profileVehicles.length === 1) {
            await processVehicle(profileVehicles[0].id, mode)
        } else {
            // Otherwise ask them to select which one (e.g. they are entering for the first time today)
            setScanResult({ vehicles: profileVehicles, multiple: true })
            setResultType('multiple')
        }
    }

    const processVehicle = async (vehicleId, mode) => {
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

            setScanResult({
                vehicle,
                stagedAction: 'exit',
                duration: durationMin,
                entryTime: log.entry_time,
                zone: zones.find(z => z.id === log.zone_id)?.name || 'Unknown',
                activeLogId: log.id
            })
            setResultType('staged')
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

            if (!selectedZone) {
                setScanResult({ vehicle, error: 'Please select a parking zone first.' })
                setResultType('error')
                return { handled: true }
            }

            let wrongZone = false
            let allocatedZoneName = null
            if (vehicle.allocated_zone_id && vehicle.allocated_zone_id !== selectedZone) {
                wrongZone = true
                allocatedZoneName = zones.find(z => z.id === vehicle.allocated_zone_id)?.name || 'Another Zone'
            }

            setScanResult({
                vehicle,
                stagedAction: 'entry',
                zone: zones.find(z => z.id === selectedZone)?.name || 'Selected Zone',
                zoneId: selectedZone,
                mode,
                wrongZone,
                allocatedZoneName
            })
            setResultType('staged')
        }
        setManualSearch('')
    }

    const confirmAction = async () => {
        if (!scanResult) return

        try {
            if (scanResult.stagedAction === 'entry') {
                if (scanResult.vehicle) {
                    const { error } = await supabase.from('parkease_logs').insert({
                        vehicle_id: scanResult.vehicle.id,
                        user_id: scanResult.vehicle.owner_id,
                        vehicle_number: scanResult.vehicle.vehicle_number,
                        zone_id: scanResult.zoneId,
                        guard_id: profile.id,
                        status: 'inside',
                        entry_mode: scanResult.mode,
                    })
                    if (error) throw error

                    setScanResult({ ...scanResult, action: 'entry' })
                    setResultType('entry')
                } else if (scanResult.guestPass) {
                    const pass = scanResult.guestPass
                    await supabase.from('parkease_guest_passes').update({ status: 'active', entry_time: new Date().toISOString(), entry_count: pass.entry_count + 1 }).eq('id', pass.id)
                    await supabase.from('parkease_logs').insert({
                        user_id: pass.sponsor_id,
                        vehicle_number: pass.vehicle_number,
                        zone_id: scanResult.zoneId,
                        guard_id: profile.id,
                        status: 'inside',
                        entry_mode: scanResult.mode,
                    })
                    setScanResult({ ...scanResult, action: 'entry' })
                    setResultType('entry')
                }
            } else if (scanResult.stagedAction === 'exit') {
                const now = new Date().toISOString()
                if (scanResult.vehicle) {
                    await supabase.from('parkease_logs').update({ exit_time: now, status: 'exited', duration_minutes: scanResult.duration }).eq('id', scanResult.activeLogId)
                    setScanResult({ ...scanResult, action: 'exit' })
                    setResultType('exit')
                } else if (scanResult.guestPass) {
                    const pass = scanResult.guestPass
                    await supabase.from('parkease_guest_passes').update({ status: 'exited', exit_time: now }).eq('id', pass.id)
                    if (scanResult.activeLogId) {
                        await supabase.from('parkease_logs').update({ exit_time: now, status: 'exited', duration_minutes: scanResult.duration }).eq('id', scanResult.activeLogId)
                    }
                    setScanResult({ ...scanResult, action: 'exit' })
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
                    {/* Zone Selection */}
                    <div style={{ marginBottom: 16 }}>
                        <label className="label">Entry Zone</label>
                        <select className="select" value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)}>
                            {zones.map(z => (
                                <option key={z.id} value={z.id}>
                                    {z.name} ({z.vehicle_type === 'two_wheeler' ? '2W' : '4W'})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Mode Selection */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                        <button
                            onClick={() => switchMode('qr')}
                            className={`btn ${scannerMode === 'qr' ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ flex: 1, padding: '8px 0', fontSize: '0.85rem' }}
                        >
                            <ScanLine size={16} style={{ marginRight: 6 }} /> QR Code
                        </button>
                        <button
                            onClick={() => switchMode('anpr')}
                            className={`btn ${scannerMode === 'anpr' ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ flex: 1, padding: '8px 0', fontSize: '0.85rem' }}
                        >
                            <Type size={16} style={{ marginRight: 6 }} /> Read Number Plate
                        </button>
                    </div>

                    {/* Scan Button */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                        {!scanning ? (
                            <button onClick={scannerMode === 'qr' ? startScanner : startAnprCamera} className="btn btn-primary btn-xl" style={{ flex: 1 }}>
                                <Camera size={22} /> {scannerMode === 'qr' ? 'Start QR Scanner' : 'Start Number Plate Camera'}
                            </button>
                        ) : (
                            <button onClick={scannerMode === 'qr' ? stopScanner : stopAnprCamera} className="btn btn-danger btn-xl" style={{ flex: 1 }}>
                                <X size={22} /> Stop Camera
                            </button>
                        )}
                    </div>

                    {/* QR Scanner View */}
                    {scannerMode === 'qr' && (
                        <div id="qr-reader" style={{
                            display: scanning ? 'block' : 'none',
                            marginBottom: 20, borderRadius: 16, overflow: 'hidden',
                            border: '2px solid rgba(99, 102, 241, 0.3)',
                        }} />
                    )}

                    {/* ANPR Camera View */}
                    {scannerMode === 'anpr' && scanning && (
                        <div style={{ marginBottom: 20, position: 'relative', borderRadius: 16, overflow: 'hidden', border: '2px solid rgba(99, 102, 241, 0.3)' }}>
                            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block' }} />

                            {/* Guide Frame Overlay */}
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'
                            }}>
                                <div style={{
                                    width: '80%', height: '30%', border: '2px dashed rgba(255,255,255,0.7)',
                                    borderRadius: 8, boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'
                                }} />
                                <div style={{ position: 'absolute', top: 20, color: 'white', fontWeight: 600, textShadow: '0 2px 4px rgba(0,0,0,0.5)', fontSize: '0.9rem' }}>
                                    Align license plate within the box
                                </div>
                            </div>

                            <button
                                onClick={captureAndProcessAnpr}
                                disabled={anprLoading}
                                className="btn btn-primary btn-lg"
                                style={{ position: 'absolute', bottom: 16, left: 16, right: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
                            >
                                {anprLoading ? <div className="spinner" /> : <><Camera size={18} /> Capture & Read Plate</>}
                            </button>

                            {/* Hidden canvas for capturing frame */}
                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                        </div>
                    )}

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

                                    {scanResult.stagedAction === 'entry' && scanResult.wrongZone && (
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, color: '#f59e0b', fontSize: '0.85rem', marginBottom: 16 }}>
                                            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                                            <div>
                                                <div style={{ fontWeight: 700, marginBottom: 4 }}>Wrong Zone Warning</div>
                                                <div style={{ fontSize: '0.75rem', color: '#ebd59b' }}>
                                                    This vehicle was allocated to <b>{scanResult.allocatedZoneName}</b>. Allowing entry here will reduce overflow capacity.
                                                </div>
                                            </div>
                                        </div>
                                    )}

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

                    {/* Quick Action Camera Modes for Lookup */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                        <button
                            onClick={() => switchMode('qr')}
                            className={`btn ${scannerMode === 'qr' ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ flex: 1, padding: '8px 0', fontSize: '0.85rem' }}
                        >
                            <ScanLine size={16} style={{ marginRight: 6 }} /> QR Code
                        </button>
                        <button
                            onClick={() => switchMode('anpr')}
                            className={`btn ${scannerMode === 'anpr' ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ flex: 1, padding: '8px 0', fontSize: '0.85rem' }}
                        >
                            <Type size={16} style={{ marginRight: 6 }} /> Read Plate
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                        {!scanning ? (
                            <button onClick={scannerMode === 'qr' ? startScanner : startAnprCamera} className="btn btn-primary btn-xl" style={{ flex: 1 }}>
                                <Camera size={22} /> {scannerMode === 'qr' ? 'Start QR Scanner' : 'Start Number Plate Camera'}
                            </button>
                        ) : (
                            <button onClick={scannerMode === 'qr' ? stopScanner : stopAnprCamera} className="btn btn-danger btn-xl" style={{ flex: 1 }}>
                                <X size={22} /> Stop Camera
                            </button>
                        )}
                    </div>

                    {/* QR Scanner View */}
                    {scannerMode === 'qr' && (
                        <div id="qr-reader-lookup" style={{
                            display: scanning ? 'block' : 'none',
                            marginBottom: 20, borderRadius: 16, overflow: 'hidden',
                            border: '2px solid rgba(99, 102, 241, 0.3)',
                        }} />
                    )}

                    {/* ANPR Camera View */}
                    {scannerMode === 'anpr' && scanning && (
                        <div style={{ marginBottom: 20, position: 'relative', borderRadius: 16, overflow: 'hidden', border: '2px solid rgba(99, 102, 241, 0.3)' }}>
                            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block' }} />

                            {/* Guide Frame Overlay */}
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'
                            }}>
                                <div style={{
                                    width: '80%', height: '30%', border: '2px dashed rgba(255,255,255,0.7)',
                                    borderRadius: 8, boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'
                                }} />
                                <div style={{ position: 'absolute', top: 20, color: 'white', fontWeight: 600, textShadow: '0 2px 4px rgba(0,0,0,0.5)', fontSize: '0.9rem' }}>
                                    Align license plate within the box
                                </div>
                            </div>

                            <button
                                onClick={captureAndProcessAnpr}
                                disabled={anprLoading}
                                className="btn btn-primary btn-lg"
                                style={{ position: 'absolute', bottom: 16, left: 16, right: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
                            >
                                {anprLoading ? <div className="spinner" /> : <><Camera size={18} /> Capture & Read Plate</>}
                            </button>

                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                        </div>
                    )}

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
