import React from 'react'
import { Search, AlertCircle, User, Car } from 'lucide-react'

export default function AdminSearchTab({ searchQuery, setSearchQuery, handleSearch, searchLoading, searchError, searchResults, setSelectedVehicle }) {
    return (
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

            {/* Search Results */}
            {searchResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {searchResults.map(result => (
                        <div
                            key={result.id}
                            className="glass-card"
                            onClick={() => setSelectedVehicle(result)}
                            style={{ padding: 16, cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{result.vehicle_number}</h3>
                                        <span className={`badge ${result.vehicle_type === 'two_wheeler' ? 'badge-info' : 'badge-warning'}`}>
                                            {result.vehicle_type === 'two_wheeler' ? '2-Wheeler' : '4-Wheeler'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#94a3b8' }}>
                                        <User size={12} /> {result.parkease_profiles?.full_name} ({result.parkease_profiles?.role})
                                    </div>
                                </div>
                                <span className={`badge ${result.status === 'approved' ? 'badge-success' : result.status === 'pending' ? 'badge-warning' : 'badge-error'}`}>
                                    {result.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Selected vehicle detail is handled in parent view */}
        </div>
    )
}
