import { supabase } from '../lib/supabase'

export const getCapacityData = async () => {
    try {
        const { data: zonesData, error: zonesErr } = await supabase
            .from('parkease_zones')
            .select('*')
            .eq('status', 'active')
            .order('name')
            
        if (zonesErr) throw zonesErr

        const { data: activeLogs, error: logsErr } = await supabase
            .from('parkease_logs')
            .select('zone_id, vehicle_id, vehicle_number, parkease_vehicles(vehicle_type)')
            .eq('status', 'inside')
            
        if (logsErr) throw logsErr

        // Fetch active guest passes to determine their vehicle types
        const { data: activeGuests, error: guestsErr } = await supabase
            .from('parkease_guest_passes')
            .select('vehicle_number, vehicle_type')
            .eq('status', 'active')
            
        if (guestsErr) throw guestsErr

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

            if (zone.capacity_2w_total > 0) {
                const t = zone.capacity_2w_total + (zone.capacity_2w_overflow || 0);
                rows.push({
                    zone_id: zone.id,
                    zone_name: zone.name,
                    vehicle_type: 'two_wheeler',
                    total_slots: t,
                    available_slots: Math.max(0, t - i2),
                    occupancy_percent: t > 0 ? Math.round((i2 / t) * 100) : 0
                })
            }
            if (zone.capacity_4w_total > 0) {
                const t = zone.capacity_4w_total + (zone.capacity_4w_overflow || 0);
                rows.push({
                    zone_id: zone.id,
                    zone_name: zone.name,
                    vehicle_type: 'four_wheeler',
                    total_slots: t,
                    available_slots: Math.max(0, t - i4),
                    occupancy_percent: t > 0 ? Math.round((i4 / t) * 100) : 0
                })
            }
        }
        return { data: rows, error: null }
    } catch (error) {
        console.error("Error fetching capacity:", error)
        return { data: null, error }
    }
}
