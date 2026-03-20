import React from 'react';
import { AlertTriangle, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#0f172a', color: '#f8fafc', padding: 20
                }}>
                    <div className="glass-card" style={{ maxWidth: 500, width: '100%', padding: 40, textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                            <div style={{ padding: 16, background: 'rgba(244,63,94,0.1)', borderRadius: '50%' }}>
                                <AlertTriangle size={48} color="#f43f5e" />
                            </div>
                        </div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 12 }}>Oops! Something went wrong</h1>
                        <p style={{ color: '#94a3b8', marginBottom: 24, fontSize: '0.9rem' }}>
                            We encountered an unexpected error while loading this page. Our team has been notified.
                        </p>
                        
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: 16, borderRadius: 8, textAlign: 'left', marginBottom: 24, overflowX: 'auto' }}>
                            <code style={{ fontSize: '0.8rem', color: '#fca5a5' }}>
                                {this.state.error?.toString()}
                            </code>
                        </div>

                        <button 
                            className="btn btn-primary" 
                            style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: 8 }}
                            onClick={() => window.location.href = '/'}
                        >
                            <Home size={18} /> Return to Home
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
