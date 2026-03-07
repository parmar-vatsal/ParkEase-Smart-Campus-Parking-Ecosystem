export default function VehicleInfo({ vehicle }) {
    const owner = vehicle.parkease_profiles
    return (
        <div style={{
            padding: 16, borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12, alignItems: 'center'
        }}>
            {owner?.profile_photo && (
                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'center', marginBottom: 8, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ textAlign: 'center' }}>
                        <img
                            src={owner.profile_photo}
                            alt={owner.full_name}
                            style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '3px solid #6366f1', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)' }}
                        />
                        <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Driver Identity</div>
                    </div>
                </div>
            )}

            <div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>Vehicle</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.05em' }}>{vehicle.vehicle_number}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {vehicle.brand} {vehicle.model}{vehicle.color ? ` • ${vehicle.color}` : ''}
                </div>
            </div>
            {owner && (
                <div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>Owner</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{owner.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {owner.phone}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {owner.department} • {owner.role}{owner.enrollment_id ? ` • ${owner.enrollment_id}` : ''}
                    </div>
                </div>
            )}
        </div>
    )
}
