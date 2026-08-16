import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 48, marginBottom: 12 }}>😵</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0d5a7a', marginBottom: 6 }}>문제가 생겼어요</div>
            <div style={{ fontSize: 12, color: '#8aaac8', marginBottom: 20 }}>앱을 다시 시작해 주세요</div>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '12px 28px', borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,#3a9bd5,#2ec4a9)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              다시 시도
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
