import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary capturó un error:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, maxWidth: 720, margin: '40px auto', fontFamily: 'sans-serif' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626', marginBottom: 12 }}>
            Ocurrió un error inesperado
          </div>
          <div style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
            La página tuvo un problema al mostrarse. Copia el siguiente detalle si necesitas reportarlo:
          </div>
          <pre style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 16, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#991b1b' }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{ marginTop: 16, padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
