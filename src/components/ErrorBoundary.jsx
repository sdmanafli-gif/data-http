import { Component } from 'react'

/**
 * Catches React render errors and shows a message instead of a white screen.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: '24px',
            fontFamily: 'system-ui, sans-serif',
            maxWidth: '600px',
            margin: '40px auto',
            background: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <h1 style={{ color: '#c41e2a', marginTop: 0 }}>Xəta</h1>
          <p style={{ color: '#333' }}>
            Tətbiq yüklənərkən xəta baş verdi. Aşağıdakı mesajı yoxlayın və düzəldin.
          </p>
          <pre
            style={{
              background: '#f5f5f5',
              padding: '12px',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '13px',
              border: '1px solid #eee',
            }}
          >
            {this.state.error?.message ?? String(this.state.error)}
          </pre>
          <p style={{ fontSize: '13px', color: '#666' }}>
            Brauzerin konsolunda (F12 → Console) ətraflı stack trace görə bilərsiniz.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
