import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    LayoutDashboard, Car, QrCode, Shield, LogOut, Menu, X,
    ParkingCircle, ScanLine, Users, ChevronRight, User
} from 'lucide-react'
import { useState } from 'react'

const navItems = {
    student: [
        { path: '/student', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/student/vehicles', label: 'My Vehicles', icon: Car },
        { path: '/student/register-vehicle', label: 'Register Vehicle', icon: QrCode },
        { path: '/student/profile', label: 'My Profile', icon: User },
    ],
    faculty: [
        { path: '/staff', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/staff/vehicles', label: 'My Vehicles', icon: Car },
        { path: '/staff/register-vehicle', label: 'Register Vehicle', icon: QrCode },
        { path: '/student/profile', label: 'My Profile', icon: User },
    ],
    staff: [
        { path: '/staff', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/staff/vehicles', label: 'My Vehicles', icon: Car },
        { path: '/staff/register-vehicle', label: 'Register Vehicle', icon: QrCode },
        { path: '/student/profile', label: 'My Profile', icon: User },
    ],
    guard: [
        { path: '/guard', label: 'Scanner', icon: ScanLine },
    ],
    admin: [
        { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/guard', label: 'Guard Scanner', icon: ScanLine },
    ],
}

export default function Layout({ children }) {
    const { profile, signOut } = useAuth()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const location = useLocation()
    const navigate = useNavigate()

    const items = navItems[profile?.role] || navItems.student

    const getRoleBadge = (role) => {
        const colors = {
            admin: 'badge-danger',
            guard: 'badge-warning',
            faculty: 'badge-info',
            staff: 'badge-info',
            student: 'badge-success',
        }
        return colors[role] || 'badge-info'
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <div className="animated-bg" />

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    onClick={() => setSidebarOpen(false)}
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                        zIndex: 40, display: 'none',
                    }}
                    className="mobile-overlay"
                />
            )}

            {/* Sidebar */}
            <aside style={{
                width: 260,
                background: 'rgba(15, 23, 42, 0.95)',
                borderRight: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                flexDirection: 'column',
                padding: '24px 16px',
                position: 'fixed',
                top: 0,
                left: sidebarOpen ? 0 : -260,
                height: '100vh',
                zIndex: 50,
                transition: 'left 0.3s ease',
            }}
                className="sidebar"
            >
                {/* Logo */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    marginBottom: 32, padding: '0 8px'
                }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <ParkingCircle size={20} color="white" />
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'white' }}>ParkEase</div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Smart Parking
                        </div>
                    </div>
                </div>

                {/* Nav Items */}
                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {items.map(({ path, label, icon: Icon }) => {
                        const isActive = location.pathname === path
                        return (
                            <NavLink
                                key={path}
                                to={path}
                                onClick={() => setSidebarOpen(false)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 12px', borderRadius: 10,
                                    color: isActive ? 'white' : '#94a3b8',
                                    background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                    textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500,
                                    transition: 'all 0.2s',
                                    borderLeft: isActive ? '3px solid #6366f1' : '3px solid transparent',
                                }}
                            >
                                <Icon size={18} />
                                {label}
                                {isActive && <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
                            </NavLink>
                        )
                    })}
                </nav>

                {/* User Info */}
                <div style={{
                    padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.06)',
                    marginTop: 16
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.875rem', fontWeight: 700, color: 'white',
                        }}>
                            {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontSize: '0.8rem', fontWeight: 600, color: 'white',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                            }}>
                                {profile?.full_name}
                            </div>
                            <span className={`badge ${getRoleBadge(profile?.role)}`} style={{ marginTop: 2 }}>
                                {profile?.role}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            await signOut()
                            navigate('/login')
                        }}
                        className="btn btn-ghost"
                        style={{ width: '100%', fontSize: '0.8rem', padding: '8px 12px' }}
                    >
                        <LogOut size={14} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main style={{ flex: 1, marginLeft: 0, minHeight: '100vh' }}>
                {/* Top Bar (mobile) */}
                <header style={{
                    padding: '12px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    backdropFilter: 'blur(20px)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 30,
                }}>
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                    >
                        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ParkingCircle size={18} color="#6366f1" />
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>ParkEase</span>
                    </div>
                    <div style={{ width: 22 }} /> {/* Spacer */}
                </header>

                <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>
                    {children}
                </div>
            </main>

            <style>{`
        @media (min-width: 769px) {
          .sidebar { left: 0 !important; }
          main { margin-left: 260px !important; }
          header { display: none !important; }
          .mobile-overlay { display: none !important; }
        }
        @media (max-width: 768px) {
          .mobile-overlay { display: block !important; }
        }
      `}</style>
        </div>
    )
}
