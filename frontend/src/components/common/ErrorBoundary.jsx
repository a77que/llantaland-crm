import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, componentStack: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ componentStack: info?.componentStack || null });
    console.error('ErrorBoundary:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626', marginBottom: 12 }}>
            Ocurrió un error inesperado
          </div>
          <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>Error:</div>
          <pre style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 16, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#991b1b', marginBottom: 12 }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          {this.state.componentStack && (
            <>
              <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>Componente donde ocurrió:</div>
              <pre style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#334155', maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
                {this.state.componentStack.trim()}
              </pre>
            </>
          )}
          <button
            onClick={() => { this.setState({ error: null, componentStack: null }); window.location.reload(); }}
            style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
