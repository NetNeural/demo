'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function HomePage() {
  const [currentTime, setCurrentTime] = useState<string>('')
  const [glowActive, setGlowActive] = useState(false)

  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString())
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Trigger glow effect on load
    setTimeout(() => setGlowActive(true), 500)
  }, [])

  return (
    <div className="min-h-screen bg-[var(--nn-body-bg-color)] text-[var(--nn-text-primary)]">
      <style jsx global>{`
        :root {
          /* NetNeural Theme System - Based on origin-ui/cellular-ui */
          --nn-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          
          /* Core Colors */
          --nn-primary: #00f5ff;
          --nn-secondary: #ff6b35;
          --nn-accent: #7c3aed;
          --nn-success: #4caf50;
          --nn-warning: #ff9800;
          --nn-alert: #f44336;
          --nn-offline: #666;
          
          /* Background & Text */
          --nn-body-bg-color: #0a0a0f;
          --nn-card-bg-color: #1a1a2e;
          --nn-text-primary: #ffffff;
          --nn-text-secondary: #b8b8b8;
          --nn-border-color: #2a2a40;
          
          /* Glow Effects */
          --nn-glow-primary: 0 0 20px rgba(0, 245, 255, 0.5);
          --nn-glow-secondary: 0 0 20px rgba(255, 107, 53, 0.5);
          --nn-glow-accent: 0 0 20px rgba(124, 58, 237, 0.5);
          --nn-glow-success: 0 0 20px rgba(76, 175, 80, 0.5);
          
          /* Gradients */
          --nn-gradient-primary: linear-gradient(135deg, #00f5ff 0%, #7c3aed 100%);
          --nn-gradient-secondary: linear-gradient(135deg, #ff6b35 0%, #f44336 100%);
          --nn-gradient-card: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
        }
        
        @media (prefers-color-scheme: light) {
          :root {
            --nn-body-bg-color: #f8fafc;
            --nn-card-bg-color: #ffffff;
            --nn-text-primary: #1a202c;
            --nn-text-secondary: #4a5568;
            --nn-border-color: #e2e8f0;
          }
        }
        
        body {
          font-family: var(--nn-font-family);
          background: var(--nn-body-bg-color);
          color: var(--nn-text-primary);
        }
        
        .neural-glow {
          box-shadow: var(--nn-glow-primary);
          transition: all 0.3s ease;
        }
        
        .neural-glow:hover {
          box-shadow: 0 0 30px rgba(0, 245, 255, 0.8);
          transform: translateY(-2px);
        }
        
        .neural-card {
          background: var(--nn-gradient-card);
          border: 1px solid var(--nn-border-color);
          border-radius: 16px;
          position: relative;
          overflow: hidden;
        }
        
        .neural-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: var(--nn-gradient-primary);
          opacity: 0.6;
        }
        
        .status-indicator {
          position: relative;
          display: inline-block;
        }
        
        .status-indicator::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          height: 100%;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        
        .status-ok::after {
          background: rgba(76, 175, 80, 0.3);
        }
        
        .status-warning::after {
          background: rgba(255, 152, 0, 0.3);
        }
        
        .status-alert::after {
          background: rgba(244, 67, 54, 0.3);
        }
        
        @keyframes pulse {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }
        
        .neural-logo {
          background: var(--nn-gradient-primary);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 900;
          letter-spacing: -0.05em;
        }
        
        .module-card {
          background: var(--nn-gradient-card);
          border: 1px solid var(--nn-border-color);
          border-radius: 20px;
          position: relative;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .module-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--nn-gradient-primary);
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: -1;
        }
        
        .module-card:hover::before {
          opacity: 0.1;
        }
        
        .module-card:hover {
          transform: translateY(-8px) scale(1.02);
          box-shadow: 0 20px 60px rgba(0, 245, 255, 0.3);
          border-color: var(--nn-primary);
        }
        
        .data-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
        }
        
        .metric-card {
          background: var(--nn-card-bg-color);
          border: 1px solid var(--nn-border-color);
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        
        .metric-card::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          box-shadow: 0 0 10px currentColor;
        }
        
        .metric-success::after {
          background: var(--nn-success);
          color: var(--nn-success);
        }
        
        .metric-primary::after {
          background: var(--nn-primary);
          color: var(--nn-primary);
        }
        
        .metric-warning::after {
          background: var(--nn-warning);
          color: var(--nn-warning);
        }
        
        .metric-accent::after {
          background: var(--nn-accent);
          color: var(--nn-accent);
        }
      `}</style>

      {/* Futuristic Header */}
      <header className="relative border-b border-[var(--nn-border-color)] bg-[var(--nn-card-bg-color)]">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--nn-primary)] to-transparent opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`relative ${glowActive ? 'neural-glow' : ''}`}>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--nn-primary)] to-[var(--nn-accent)] flex items-center justify-center">
                  <span className="text-black font-black text-xl">N</span>
                </div>
              </div>
              <div>
                <h1 className="neural-logo text-2xl font-black">NetNeural</h1>
                <p className="text-[var(--nn-text-secondary)] text-sm font-medium">IoT Platform • Neural Network</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="hidden md:flex items-center space-x-4">
                <div className="status-indicator status-ok">
                  <div className="w-3 h-3 bg-[var(--nn-success)] rounded-full"></div>
                </div>
                <span className="text-sm text-[var(--nn-text-secondary)]">Neural Net: Online</span>
              </div>
              <div className="text-sm font-mono text-[var(--nn-primary)]">{currentTime}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Neural Network Status Banner */}
      <div className="bg-gradient-to-r from-[var(--nn-primary)] to-[var(--nn-accent)] text-black px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-center space-x-6 text-sm font-semibold">
          <span>🧠 Neural Processing: Active</span>
          <span>📡 IoT Network: 12 Nodes Connected</span>
          <span>⚡ Real-time Data: Streaming</span>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-5xl font-black mb-6 bg-gradient-to-r from-[var(--nn-primary)] via-[var(--nn-accent)] to-[var(--nn-secondary)] bg-clip-text text-transparent">
            Neural IoT Platform
          </h2>
          <p className="text-xl text-[var(--nn-text-secondary)] mb-8 max-w-3xl mx-auto leading-relaxed">
            Advanced sensor management powered by neural networks. Real-time monitoring, 
            predictive analytics, and intelligent automation for the connected world.
          </p>
        </div>

        {/* System Modules */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Full Dashboard Module */}
          <Link href="/dashboard" className="group block">
            <div className="module-card p-8 h-full">
              <div className="flex items-center justify-between mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--nn-primary)] to-[var(--nn-accent)] flex items-center justify-center neural-glow">
                  <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                  </svg>
                </div>
                <div className="text-[var(--nn-primary)] group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </div>
              
              <h3 className="text-2xl font-bold mb-4 text-[var(--nn-text-primary)]">Neural Dashboard</h3>
              <p className="text-[var(--nn-text-secondary)] mb-6 leading-relaxed">
                Complete IoT command center with real-time neural analysis, predictive insights, 
                and intelligent device orchestration across your entire sensor network.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-2 h-2 bg-[var(--nn-success)] rounded-full neural-glow"></div>
                  <span>12 Active Sensors</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-2 h-2 bg-[var(--nn-primary)] rounded-full neural-glow"></div>
                  <span>Real-time Analytics</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-2 h-2 bg-[var(--nn-accent)] rounded-full neural-glow"></div>
                  <span>Neural Predictions</span>
                </div>
              </div>
            </div>
          </Link>

          {/* Test Interface Module */}
          <Link href="/test" className="group block">
            <div className="module-card p-8 h-full">
              <div className="flex items-center justify-between mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--nn-secondary)] to-[var(--nn-warning)] flex items-center justify-center neural-glow">
                  <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                  </svg>
                </div>
                <div className="text-[var(--nn-secondary)] group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </div>
              
              <h3 className="text-2xl font-bold mb-4 text-[var(--nn-text-primary)]">Neural Diagnostics</h3>
              <p className="text-[var(--nn-text-secondary)] mb-6 leading-relaxed">
                Advanced testing interface for sensor calibration, network validation, 
                and neural network training with real-time performance metrics.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-2 h-2 bg-[var(--nn-warning)] rounded-full neural-glow"></div>
                  <span>System Diagnostics</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-2 h-2 bg-[var(--nn-secondary)] rounded-full neural-glow"></div>
                  <span>Neural Training</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-2 h-2 bg-[var(--nn-success)] rounded-full neural-glow"></div>
                  <span>API Testing</span>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Neural Network Metrics */}
        <div className="neural-card p-8 mb-16">
          <h3 className="text-2xl font-bold mb-8 text-center text-[var(--nn-text-primary)]">Neural Network Status</h3>
          <div className="data-grid">
            <div className="metric-card metric-success">
              <div className="status-indicator status-ok mb-3">
                <div className="w-6 h-6 bg-[var(--nn-success)] rounded-full mx-auto"></div>
              </div>
              <div className="text-3xl font-black text-[var(--nn-text-primary)] mb-2">12</div>
              <div className="text-sm text-[var(--nn-text-secondary)] font-medium">Active Sensors</div>
            </div>
            
            <div className="metric-card metric-primary">
              <div className="status-indicator status-ok mb-3">
                <div className="w-6 h-6 bg-[var(--nn-primary)] rounded-full mx-auto"></div>
              </div>
              <div className="text-3xl font-black text-[var(--nn-text-primary)] mb-2">5</div>
              <div className="text-sm text-[var(--nn-text-secondary)] font-medium">Neural Nodes</div>
            </div>
            
            <div className="metric-card metric-warning">
              <div className="status-indicator status-warning mb-3">
                <div className="w-6 h-6 bg-[var(--nn-warning)] rounded-full mx-auto"></div>
              </div>
              <div className="text-3xl font-black text-[var(--nn-text-primary)] mb-2">3</div>
              <div className="text-sm text-[var(--nn-text-secondary)] font-medium">Active Alerts</div>
            </div>
            
            <div className="metric-card metric-accent">
              <div className="status-indicator status-ok mb-3">
                <div className="w-6 h-6 bg-[var(--nn-accent)] rounded-full mx-auto"></div>
              </div>
              <div className="text-3xl font-black text-[var(--nn-text-primary)] mb-2">99.8%</div>
              <div className="text-sm text-[var(--nn-text-secondary)] font-medium">Neural Uptime</div>
            </div>
          </div>
        </div>

        {/* Neural Capabilities Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          <div className="neural-card p-6">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[var(--nn-primary)] to-[var(--nn-accent)] flex items-center justify-center mb-4 neural-glow">
              <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 2.05v3.03c3.39.49 6 3.39 6 6.92 0 .9-.18 1.75-.48 2.54l2.6 1.53c.56-1.24.88-2.62.88-4.07 0-5.18-3.95-9.45-9-9.95zM12 19c-3.87 0-7-3.13-7-7 0-3.53 2.61-6.43 6-6.92V2.05c-5.06.5-9 4.76-9 9.95 0 5.52 4.47 10 9.99 10 3.31 0 6.24-1.61 8.06-4.09l-2.6-1.53C16.17 17.98 14.21 19 12 19z"/>
              </svg>
            </div>
            <h4 className="text-lg font-bold text-[var(--nn-text-primary)] mb-3">Real-time Processing</h4>
            <p className="text-[var(--nn-text-secondary)] text-sm leading-relaxed">
              Neural network processes sensor data in milliseconds with predictive anomaly detection and automated response triggers.
            </p>
          </div>

          <div className="neural-card p-6">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[var(--nn-secondary)] to-[var(--nn-warning)] flex items-center justify-center mb-4 neural-glow">
              <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <h4 className="text-lg font-bold text-[var(--nn-text-primary)] mb-3">Intelligent Mapping</h4>
            <p className="text-[var(--nn-text-secondary)] text-sm leading-relaxed">
              Advanced spatial intelligence with 3D sensor positioning, automated zone detection, and neural path optimization.
            </p>
          </div>

          <div className="neural-card p-6">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[var(--nn-accent)] to-[var(--nn-alert)] flex items-center justify-center mb-4 neural-glow">
              <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01L23 10z"/>
              </svg>
            </div>
            <h4 className="text-lg font-bold text-[var(--nn-text-primary)] mb-3">Predictive Alerts</h4>
            <p className="text-[var(--nn-text-secondary)] text-sm leading-relaxed">
              AI-powered alert system learns patterns, predicts failures before they occur, and adapts notification strategies.
            </p>
          </div>
        </div>
      </main>

      {/* Neural Footer */}
      <footer className="border-t border-[var(--nn-border-color)] bg-[var(--nn-card-bg-color)] mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--nn-primary)] to-[var(--nn-accent)] flex items-center justify-center">
                <span className="text-black font-black text-sm">N</span>
              </div>
              <span className="neural-logo text-lg font-black">NetNeural IoT Platform</span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-[var(--nn-text-secondary)]">
              <span>© 2025 Neural Networks</span>
              <span className="font-mono text-[var(--nn-primary)]">Last sync: {currentTime}</span>
              <span>🧠 Neural Core: Active</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
