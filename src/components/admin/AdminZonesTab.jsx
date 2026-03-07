import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Map, ShieldAlert, CheckCircle, Info } from 'lucide-react';

export default function AdminZonesTab() {
    const [zones, setZones] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState(getInitialFormState());
    const [formMsg, setFormMsg] = useState(null);
    const [saving, setSaving] = useState(false);

    // Department Selection State
    const [selectedDepts, setSelectedDepts] = useState([]); // [{ code, priority }]

    useEffect(() => {
        fetchData();
    }, []);

    function getInitialFormState() {
        return {
            name: '',
            code: '',
            nearest_building: '',
            gates: '',
            status: 'active',
            capacity_2w_total: 0,
            capacity_2w_reserved: 0,
            capacity_2w_overflow: 0,
            capacity_4w_total: 0,
            capacity_4w_reserved: 0,
            capacity_4w_overflow: 0,
        };
    }

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Zones with their current mapped departments
            const { data: zonesData, error: zonesErr } = await supabase
                .from('parkease_zones')
                .select(`
          *,
          parkease_zone_departments (
            priority,
            parkease_departments ( code, name )
          )
        `)
                .order('name');

            if (zonesErr) throw zonesErr;
            setZones(zonesData || []);

            // Fetch all available departments
            const { data: deptsData, error: deptsErr } = await supabase
                .from('parkease_departments')
                .select('*')
                .order('name');

            if (deptsErr) throw deptsErr;
            setDepartments(deptsData || []);

        } catch (err) {
            console.error('Error fetching zones data:', err);
        } finally {
            setLoading(false);
        }
    };

    const seedDepartments = async () => {
        setSaving(true);
        try {
            const scetDepts = [
                { code: 'AI', name: 'Artificial Intelligence & Data Science' },
                { code: 'ASH', name: 'Applied Science and Humanities' },
                { code: 'CH', name: 'Chemical Engineering' },
                { code: 'CV', name: 'Civil Engineering' },
                { code: 'CO', name: 'Computer Engineering' },
                { code: 'EL', name: 'Electrical Engineering' },
                { code: 'EC', name: 'Electronics & Communication Engineering' },
                { code: 'IT', name: 'Information Technology' },
                { code: 'IC', name: 'Instrumentation and Control' },
                { code: 'MCA', name: 'MCA' },
                { code: 'ME', name: 'Mechanical Engineering' },
                { code: 'TT', name: 'Textile Technology' }
            ];

            const { error } = await supabase
                .from('parkease_departments')
                .upsert(scetDepts, { onConflict: 'code' });

            if (error) throw error;
            await fetchData();
            setFormMsg({ type: 'success', text: 'Default departments seeded successfully!' });
        } catch (err) {
            console.error(err);
            setFormMsg({ type: 'error', text: 'Failed to seed: ' + err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (zone) => {
        setEditingId(zone.id);
        setFormData({
            name: zone.name || '',
            code: zone.code || '',
            nearest_building: zone.nearest_building || '',
            gates: (zone.gates || []).join(', '),
            status: zone.status || 'active',
            capacity_2w_total: zone.capacity_2w_total || 0,
            capacity_2w_reserved: zone.capacity_2w_reserved || 0,
            capacity_2w_overflow: zone.capacity_2w_overflow || 0,
            capacity_4w_total: zone.capacity_4w_total || 0,
            capacity_4w_reserved: zone.capacity_4w_reserved || 0,
            capacity_4w_overflow: zone.capacity_4w_overflow || 0,
        });

        // Map existing departments
        if (zone.parkease_zone_departments) {
            setSelectedDepts(zone.parkease_zone_departments.map(d => ({
                code: d.parkease_departments.code,
                priority: d.priority
            })));
        } else {
            setSelectedDepts([]);
        }

        setShowForm(true);
        setFormMsg(null);
    };

    const handleNew = () => {
        setEditingId(null);
        setFormData(getInitialFormState());
        setSelectedDepts([]);
        setShowForm(true);
        setFormMsg(null);
    };

    const addDepartment = (code) => {
        if (!code) return;
        if (selectedDepts.find(d => d.code === code)) return;
        // Default priority = 5
        setSelectedDepts([...selectedDepts, { code, priority: 5 }]);
    };

    const removeDepartment = (code) => {
        setSelectedDepts(selectedDepts.filter(d => d.code !== code));
    };

    const updateDepartmentPriority = (code, priority) => {
        setSelectedDepts(selectedDepts.map(d =>
            d.code === code ? { ...d, priority: parseInt(priority) } : d
        ));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFormMsg(null);

        if (selectedDepts.length === 0) {
            setFormMsg({ type: 'error', text: 'You must map at least one department to this zone.' });
            setSaving(false);
            return;
        }

        try {
            // 1. Prepare Zone Data
            const zonePayload = {
                name: formData.name,
                code: formData.code.toUpperCase(),
                nearest_building: formData.nearest_building,
                gates: formData.gates.split(',').map(g => g.trim()).filter(g => g),
                status: formData.status,
                capacity_2w_total: parseInt(formData.capacity_2w_total),
                capacity_2w_reserved: parseInt(formData.capacity_2w_reserved),
                capacity_2w_overflow: parseInt(formData.capacity_2w_overflow),
                capacity_4w_total: parseInt(formData.capacity_4w_total),
                capacity_4w_reserved: parseInt(formData.capacity_4w_reserved),
                capacity_4w_overflow: parseInt(formData.capacity_4w_overflow),
            };

            let savedZoneId = editingId;

            if (editingId) {
                // Update existing zone
                const { error } = await supabase
                    .from('parkease_zones')
                    .update(zonePayload)
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                // Create new zone
                const { data, error } = await supabase
                    .from('parkease_zones')
                    .insert([zonePayload])
                    .select()
                    .single();
                if (error) throw error;
                savedZoneId = data.id;
            }

            // 2. Sync Departments (Delete existing mappings, then re-insert)
            const { error: delErr } = await supabase
                .from('parkease_zone_departments')
                .delete()
                .eq('zone_id', savedZoneId);
            if (delErr) throw delErr;

            const deptPayload = selectedDepts.map(d => ({
                zone_id: savedZoneId,
                department_code: d.code,
                priority: d.priority
            }));

            const { error: insErr } = await supabase
                .from('parkease_zone_departments')
                .insert(deptPayload);
            if (insErr) throw insErr;

            setFormMsg({ type: 'success', text: `Zone ${editingId ? 'updated' : 'created'} successfully!` });
            setTimeout(() => {
                setShowForm(false);
                fetchData();
            }, 1500);

        } catch (err) {
            console.error(err);
            setFormMsg({ type: 'error', text: err.message || 'An error occurred while saving.' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (zoneId) => {
        if (!confirm('Are you sure you want to permanently delete this zone? All mappings will be lost. (Vehicles currently in this zone may be orphaned).')) return;

        try {
            const { error } = await supabase.from('parkease_zones').delete().eq('id', zoneId);
            if (error) throw error;
            fetchData();
        } catch (err) {
            alert('Error deleting zone: ' + err.message);
        }
    };

    if (loading) {
        return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>;
    }

    return (
        <div className="animate-fade-in">
            {!showForm ? (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Campus Parking Zones</h2>
                            <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 4 }}>
                                Manage physical parking areas, capacities, and department allocations.
                            </p>
                        </div>
                        <button onClick={handleNew} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Plus size={16} /> Create Zone
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                        {zones.map(zone => (
                            <div key={zone.id} className="glass-card" style={{ padding: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>{zone.name}</h3>
                                            {zone.status === 'active'
                                                ? <span className="badge badge-success" style={{ fontSize: '0.6rem' }}>ACTIVE</span>
                                                : <span className="badge badge-warning" style={{ fontSize: '0.6rem' }}>{zone.status.toUpperCase()}</span>
                                            }
                                        </div>
                                        <div style={{ color: '#818cf8', fontSize: '0.75rem', fontWeight: 700, marginTop: 4 }}>
                                            CODE: {zone.code}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => handleEdit(zone)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }} title="Edit Zone">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(zone.id)} style={{ background: 'transparent', border: 'none', color: '#f43f5e', cursor: 'pointer' }} title="Delete Zone">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Capacity Summary */}
                                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 4 }}>2-WHEELER</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <div><span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{zone.capacity_2w_total}</span><span style={{ fontSize: '0.65rem', color: '#64748b' }}> total</span></div>
                                            {zone.capacity_2w_overflow > 0 && <div style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600 }}>+{zone.capacity_2w_overflow} OVF</div>}
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 4 }}>4-WHEELER</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <div><span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{zone.capacity_4w_total}</span><span style={{ fontSize: '0.65rem', color: '#64748b' }}> total</span></div>
                                            {zone.capacity_4w_overflow > 0 && <div style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600 }}>+{zone.capacity_4w_overflow} OVF</div>}
                                        </div>
                                    </div>
                                </div>

                                {/* Mapped Departments */}
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>MAPPED DEPARTMENTS</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {zone.parkease_zone_departments?.length > 0 ? (
                                            zone.parkease_zone_departments.sort((a, b) => b.priority - a.priority).map(map => (
                                                <span key={map.parkease_departments.code} style={{
                                                    fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                                                    background: 'rgba(129,140,248,0.15)', color: '#a5b4fc', border: '1px solid rgba(129,140,248,0.3)'
                                                }}>
                                                    {map.parkease_departments.code} (P{map.priority})
                                                </span>
                                            ))
                                        ) : (
                                            <span style={{ fontSize: '0.75rem', color: '#f43f5e' }}>No departments mapped!</span>
                                        )}
                                    </div>
                                </div>

                                {zone.nearest_building && (
                                    <div style={{ marginTop: 12, fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Map size={14} /> Near: {zone.nearest_building}
                                    </div>
                                )}
                            </div>
                        ))}

                        {zones.length === 0 && (
                            <div className="glass-card" style={{ padding: 40, textAlign: 'center', gridColumn: '1 / -1' }}>
                                <Map size={32} color="#475569" style={{ margin: '0 auto 12px' }} />
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>No Zones Configured</h3>
                                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: 20 }}>
                                    Create your first parking zone to start allocating parking space to departments.
                                </p>
                                <button onClick={handleNew} className="btn btn-primary" style={{ margin: '0 auto' }}>Create Zone</button>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                // --- ZONE CREATE / EDIT FORM ---
                <div className="glass-card animate-slide-up" style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 16 }}>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Map color="#818cf8" /> {editingId ? 'Edit Zone' : 'Create New Zone'}
                        </h2>
                        <button onClick={() => setShowForm(false)} className="btn" style={{ background: 'rgba(255,255,255,0.05)' }}>Cancel</button>
                    </div>

                    {formMsg && (
                        <div style={{
                            padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 10,
                            background: formMsg.type === 'error' ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)',
                            color: formMsg.type === 'error' ? '#f43f5e' : '#10b981',
                            border: `1px solid ${formMsg.type === 'error' ? 'rgba(244,63,94,0.3)' : 'rgba(16,185,129,0.3)'}`
                        }}>
                            {formMsg.type === 'error' ? <ShieldAlert size={18} /> : <CheckCircle size={18} />}
                            {formMsg.text}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                        {/* Section: Basic Info */}
                        <div>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#818cf8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Basic Details</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div>
                                    <label className="label">Zone Name *</label>
                                    <input className="input" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Zone A - Main Gate" />
                                </div>
                                <div>
                                    <label className="label">Zone Code (Unique) *</label>
                                    <input className="input" required value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="e.g. ZONE_A" style={{ textTransform: 'uppercase' }} />
                                </div>
                                <div>
                                    <label className="label">Nearest Building</label>
                                    <select className="select" value={formData.nearest_building} onChange={e => setFormData({ ...formData, nearest_building: e.target.value })}>
                                        <option value="">-- Select Building --</option>
                                        <option value="Building 1">Building 1</option>
                                        <option value="Building 2">Building 2</option>
                                        <option value="Building 3">Building 3</option>
                                        <option value="Building 4">Building 4</option>
                                        <option value="Building 5">Building 5</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Access Gates</label>
                                    <select className="select" value={formData.gates} onChange={e => setFormData({ ...formData, gates: e.target.value })}>
                                        <option value="">-- Select Gate --</option>
                                        <option value="Gate 1">Gate 1</option>
                                        <option value="Gate 2">Gate 2</option>
                                        <option value="Gate 3">Gate 3</option>
                                        <option value="Gate 4">Gate 4</option>
                                        <option value="Gate 5">Gate 5</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Status</label>
                                    <select className="select" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="maintenance">Under Maintenance</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section: Capacity */}
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#818cf8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 8 }}>
                                2. Capacity Limits
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'none', fontWeight: 400 }}><Info size={12} style={{ display: 'inline', marginBottom: -2 }} /> Set 0 if not allowed.</span>
                            </h3>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                                {/* 2W Capacity */}
                                <div>
                                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 12, color: '#e2e8f0' }}>🏍️ Two-Wheeler Capacity</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <div>
                                            <label className="label" style={{ fontSize: '0.7rem' }}>Total Slots *</label>
                                            <input type="number" min="0" className="input" required value={formData.capacity_2w_total} onChange={e => setFormData({ ...formData, capacity_2w_total: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="label" style={{ fontSize: '0.7rem' }}>Overflow Allowed</label>
                                            <input type="number" min="0" className="input" value={formData.capacity_2w_overflow} onChange={e => setFormData({ ...formData, capacity_2w_overflow: e.target.value })} />
                                        </div>
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <label className="label" style={{ fontSize: '0.7rem' }}>Reserved (Faculty/Staff)</label>
                                            <input type="number" min="0" className="input" value={formData.capacity_2w_reserved} onChange={e => setFormData({ ...formData, capacity_2w_reserved: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                {/* 4W Capacity */}
                                <div>
                                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 12, color: '#e2e8f0' }}>🚗 Four-Wheeler Capacity</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <div>
                                            <label className="label" style={{ fontSize: '0.7rem' }}>Total Slots *</label>
                                            <input type="number" min="0" className="input" required value={formData.capacity_4w_total} onChange={e => setFormData({ ...formData, capacity_4w_total: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="label" style={{ fontSize: '0.7rem' }}>Overflow Allowed</label>
                                            <input type="number" min="0" className="input" value={formData.capacity_4w_overflow} onChange={e => setFormData({ ...formData, capacity_4w_overflow: e.target.value })} />
                                        </div>
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <label className="label" style={{ fontSize: '0.7rem' }}>Reserved (Faculty/Staff)</label>
                                            <input type="number" min="0" className="input" value={formData.capacity_4w_reserved} onChange={e => setFormData({ ...formData, capacity_4w_reserved: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section: Department Mapping */}
                        <div>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#818cf8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>3. Department Allocation Rules *</h3>
                            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 16 }}>
                                Assign which departments should park in this zone. Higher priority (e.g. 10) means this zone is chosen first for that department.
                            </p>

                            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                                {departments.length > 0 ? (
                                    <>
                                        <select id="deptSelect" className="select" style={{ flex: 1 }}>
                                            <option value="">-- Select a department to add --</option>
                                            {departments.map(d => (
                                                <option key={d.code} value={d.code} disabled={selectedDepts.some(s => s.code === d.code)}>
                                                    {d.code} - {d.name}
                                                </option>
                                            ))}
                                        </select>
                                        <button type="button" className="btn btn-secondary" onClick={() => {
                                            const val = document.getElementById('deptSelect').value;
                                            addDepartment(val);
                                            document.getElementById('deptSelect').value = '';
                                        }}>
                                            Add
                                        </button>
                                    </>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'rgba(244,63,94,0.05)', padding: 12, borderRadius: 8, border: '1px solid rgba(244,63,94,0.2)' }}>
                                        <div style={{ flex: 1, fontSize: '0.8rem', color: '#fca5a5' }}>
                                            <AlertCircle size={14} style={{ display: 'inline', marginRight: 6, marginBottom: -2 }} />
                                            No departments found in database.
                                        </div>
                                        <button type="button" onClick={seedDepartments} className="btn btn-sm btn-secondary" disabled={saving}>
                                            {saving ? 'Seeding...' : 'Seed Default SCET Depts'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {selectedDepts.length > 0 ? (
                                <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                        <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                                            <tr>
                                                <th style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Department Code</th>
                                                <th style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', width: 140 }}>Priority (1-10)</th>
                                                <th style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', width: 80, textAlign: 'center' }}>Remove</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedDepts.sort((a, b) => b.priority - a.priority).map(dept => (
                                                <tr key={dept.code} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{dept.code}</td>
                                                    <td style={{ padding: '8px 16px' }}>
                                                        <input
                                                            type="number" min="1" max="10" className="input"
                                                            style={{ padding: '6px 12px', height: 'auto' }}
                                                            value={dept.priority}
                                                            onChange={(e) => updateDepartmentPriority(dept.code, e.target.value)}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                                                        <button type="button" onClick={() => removeDepartment(dept.code)} style={{ background: 'transparent', border: 'none', color: '#f43f5e', cursor: 'pointer' }}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div style={{ padding: '16px', background: 'rgba(244,63,94,0.05)', color: '#fca5a5', border: '1px dashed rgba(244,63,94,0.3)', borderRadius: 8, textAlign: 'center', fontSize: '0.85rem' }}>
                                    No departments assigned! You must assign at least one department so students can be allocated here.
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <button type="button" onClick={() => setShowForm(false)} className="btn" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={saving || selectedDepts.length === 0}>
                                {saving ? <div className="spinner" style={{ width: 16, height: 16 }} /> : 'Save Zone'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
