import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import { Suspense, lazy } from 'react'
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const StaffRegister = lazy(() => import('./pages/StaffRegister'))
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'))
const StaffDashboard = lazy(() => import('./pages/StaffDashboard'))
const GuardScanner = lazy(() => import('./pages/GuardScanner'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const VehicleRegister = lazy(() => import('./pages/VehicleRegister'))
const MyVehicles = lazy(() => import('./pages/MyVehicles'))
const GuestInvites = lazy(() => import('./pages/GuestInvites'))
const WalkInRegistration = lazy(() => import('./pages/WalkInRegistration'))
const StudentProfile = lazy(() => import('./pages/StudentProfile'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))



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
                <Suspense fallback={<LoadingScreen />}>
                    <Routes>
                        {/* --- Public Routes (redirect away if already logged in) --- */}
                        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
                        <Route path="/staff/register" element={<PublicRoute><StaffRegister /></PublicRoute>} />
                        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
                        <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
                        <Route path="/walkin" element={<PublicRoute><WalkInRegistration /></PublicRoute>} />

                        {/* --- Protected Routes (require login) --- */}
                        {/* 1. Dashboard Routing (Main Entry) */}
                        <Route path="/dashboard" element={
                            <ProtectedRoute>
                                <Layout>
                                    <RoleDashboard />
                                </Layout>
                            </ProtectedRoute>
                        } />

                        {/* 2. Admin & Guard Specific Routes */}
                        <Route path="/scanner" element={
                            <ProtectedRoute allowedRoles={['guard', 'admin']}>
                                <Layout>
                                    <GuardScanner />
                                </Layout>
                            </ProtectedRoute>
                        } />

                        {/* 3. Student / Staff Own Routes */}
                        <Route path="/vehicles/register" element={
                            <ProtectedRoute allowedRoles={['student', 'staff']}>
                                <Layout>
                                    <VehicleRegister />
                                </Layout>
                            </ProtectedRoute>
                        } />

                        <Route path="/vehicles" element={
                            <ProtectedRoute allowedRoles={['student', 'staff']}>
                                <Layout>
                                    <MyVehicles />
                                </Layout>
                            </ProtectedRoute>
                        } />

                        <Route path="/invites" element={
                            <ProtectedRoute allowedRoles={['student', 'staff']}>
                                <Layout>
                                    <GuestInvites />
                                </Layout>
                            </ProtectedRoute>
                        } />

                        <Route path="/profile" element={
                            <ProtectedRoute allowedRoles={['student', 'staff']}>
                                <Layout>
                                    <StudentProfile />
                                </Layout>
                            </ProtectedRoute>
                        } />

                        {/* --- Fallbacks --- */}
                        <Route path="/" element={<Navigate to="/login" replace />} />
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                </Suspense>
            </AuthProvider>
        </BrowserRouter>
    )
}
