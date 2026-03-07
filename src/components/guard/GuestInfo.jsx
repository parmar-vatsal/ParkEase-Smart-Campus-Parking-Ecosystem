export default function GuestInfo({ pass, action, isExpired }) {
    const sponsor = pass.parkease_profiles
    return (
        <div style={{
            padding: 16, borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            border: isExpired && action === 'exit' ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid rgba(16, 185, 129, 0.2)',
            display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12, alignItems: 'center'
        }}>
            {sponsor?.profile_photo && (
                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'center', marginBottom: 8, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ textAlign: 'center' }}>
                        <img
                            src={sponsor.profile_photo}
                            alt={sponsor.full_name}
                            style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)' }}
                        />
                        <div style={{ marginTop: 6, fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase' }}>Sponsor</div>
                    </div>
                </div>
            )}

            <div style={{ gridColumn: 'span 2' }}>
                <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>GUEST PASS</span>
                {isExpired && action === 'exit' && (
                    <span className="badge badge-danger" style={{ fontSize: '0.65rem', marginLeft: 8 }}>⚠️ OVERSTAYED</span>
                )}
            </div>

            <div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>Vehicle & Guest</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.05em' }}>{pass.vehicle_number}</div>
                <div style={{ fontSize: '0.75rem', color: '#f8fafc' }}>
                    {pass.guest_name}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    Type: {pass.vehicle_type === 'four_wheeler' ? 'Car' : 'Two Wheeler'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#f43f5e', marginTop: 4 }}>
                    Valid Till: {new Date(pass.valid_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
            {sponsor ? (
                <div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>Sponsor</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{sponsor.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {sponsor.phone}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {sponsor.role}
                    </div>
                </div>
            ) : (
                <div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>Sponsor</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f59e0b' }}>NO SPONSOR</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Public Walk-in Registration
                    </div>
                </div>
            )}
        </div>
    )
}
