import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import StaffRegister from './pages/StaffRegister'
import StudentDashboard from './pages/StudentDashboard'
import StaffDashboard from './pages/StaffDashboard'
import GuardScanner from './pages/GuardScanner'
import AdminDashboard from './pages/AdminDashboard'
import VehicleRegister from './pages/VehicleRegister'
import MyVehicles from './pages/MyVehicles'
import GuestInvites from './pages/GuestInvites'
import WalkInRegistration from './pages/WalkInRegistration'
import StudentProfile from './pages/StudentProfile'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

// Full-screen loading spinner
function LoadingScreen() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
            <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
    )
}

// Blocks access while auth is loading.
// If logged in, redirects to /dashboard. If not, shows the page.
function PublicRoute({ children }) {
    const { user, profile, loading } = useAuth()
    if (loading) return <LoadingScreen />
    if (user && profile) return <Navigate to="/dashboard" replace />
    return children
}

// Blocks unauthenticated access.
// While loading show spinner. If not logged in, send to /login.
// If role isn't allowed, redirect to role's own dashboard.
function ProtectedRoute({ children, allowedRoles }) {
    const { user, profile, loading } = useAuth()
    if (loading) return <LoadingScreen />
    if (!user || !profile) return <Navigate to="/login" replace />
    if (allowedRoles && !allowedRoles.includes(profile.role)) {
        return <Navigate to="/dashboard" replace />
    }
    return children
}

// Redirects /dashboard to the correct role page
function DashboardRedirect() {
    const { profile, loading } = useAuth()
    if (loading) return <LoadingScreen />
    if (!profile) return <Navigate to="/login" replace />
    switch (profile.role) {
        case 'admin': return <Navigate to="/admin" replace />
        case 'guard': return <Navigate to="/guard" replace />
        case 'faculty':
        case 'staff': return <Navigate to="/staff" replace />
        default: return <Navigate to="/student" replace />
    }
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    {/* --- Public Routes (redirect away if already logged in) --- */}
                    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                    <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
                    <Route path="/staff-register" element={<PublicRoute><StaffRegister /></PublicRoute>} />
                    <Route path="/visitor" element={<WalkInRegistration />} />

                    {/* --- Password Reset Flow --- */}
                    <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
                    <Route path="/reset-password" element={<ResetPassword />} />

                    {/* --- Dashboard router --- */}
                    <Route path="/dashboard" element={
                        <ProtectedRoute><DashboardRedirect /></ProtectedRoute>
                    } />

                    {/* --- Student Routes --- */}
                    <Route path="/student" element={
                        <ProtectedRoute allowedRoles={['student']}>
                            <Layout><StudentDashboard /></Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/student/vehicles" element={
                        <ProtectedRoute allowedRoles={['student']}>
                            <Layout><MyVehicles /></Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/student/register-vehicle" element={
                        <ProtectedRoute allowedRoles={['student']}>
                            <Layout><VehicleRegister /></Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/student/guests" element={
                        <ProtectedRoute allowedRoles={['student']}>
                            <Layout><GuestInvites /></Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/student/profile" element={
                        <ProtectedRoute allowedRoles={['student']}>
                            <Layout><StudentProfile /></Layout>
                        </ProtectedRoute>
                    } />

                    {/* --- Staff / Faculty Routes --- */}
                    <Route path="/staff" element={
                        <ProtectedRoute allowedRoles={['staff', 'faculty']}>
                            <Layout><StaffDashboard /></Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/staff/vehicles" element={
                        <ProtectedRoute allowedRoles={['staff', 'faculty']}>
                            <Layout><MyVehicles /></Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/staff/register-vehicle" element={
                        <ProtectedRoute allowedRoles={['staff', 'faculty']}>
                            <Layout><VehicleRegister /></Layout>
                        </ProtectedRoute>
                    } />

                    {/* --- Guard Routes --- */}
                    <Route path="/guard" element={
                        <ProtectedRoute allowedRoles={['guard', 'admin']}>
                            <Layout><GuardScanner /></Layout>
                        </ProtectedRoute>
                    } />

                    {/* --- Admin Routes --- */}
                    <Route path="/admin" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <Layout><AdminDashboard /></Layout>
                        </ProtectedRoute>
                    } />

                    {/* --- Fallbacks --- */}
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    )
}
