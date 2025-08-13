'use client';

import React from 'react';
import Link from 'next/link';
import Navigation from '../components/ui/Navigation';
import { 
  SimplePlayIcon, 
  SimpleChartIcon, 
  SimpleCpuIcon, 
  SimpleShieldIcon, 
  SimpleArrowRightIcon,
  SimpleRocketLaunchIcon
} from '../components/icons/SimpleIcons';

export default function Home() {
  return (
    <div className="page">
      <Navigation currentPage="home" />

      {/* Hero Section */}
      <section className="section section-lg">
        <div className="container text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="h1">NetNeural IoT Platform</h1>
            <p className="text-large text-muted mb-8">
              Professional IoT monitoring and management platform with real-time analytics, 
              comprehensive device management, and intelligent alerting systems.
            </p>
            <Link href="/dashboard" className="btn btn-primary btn-lg">
              <div className="icon-container icon-sm mr-2">
                <SimplePlayIcon />
              </div>
              View Live Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section bg-light">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="h2">Platform Capabilities</h2>
            <p className="text-large text-muted max-w-2xl mx-auto">
              Complete IoT infrastructure management with enterprise-grade reliability and performance.
            </p>
          </div>
          
          <div className="grid grid-3 gap-8">
            <div className="card">
              <div className="card-body text-center">
                <div className="icon-container icon-lg icon-bg-blue mb-6">
                  <SimpleChartIcon />
                </div>
                <h3 className="h3 mb-4">Real-time Analytics</h3>
                <p className="text-muted mb-6">
                  Monitor your IoT infrastructure with live data updates, interactive charts, 
                  and comprehensive performance metrics across all connected devices.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <span className="badge badge-info">Live Data</span>
                  <span className="badge badge-secondary">Interactive Charts</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body text-center">
                <div className="icon-container icon-lg icon-bg-green mb-6">
                  <SimpleCpuIcon />
                </div>
                <h3 className="h3 mb-4">Device Management</h3>
                <p className="text-muted mb-6">
                  Centralized management of sensors, devices, and endpoints with 
                  battery monitoring, health tracking, and remote configuration.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <span className="badge badge-success">Remote Control</span>
                  <span className="badge badge-secondary">Battery Monitor</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body text-center">
                <div className="icon-container icon-lg icon-bg-purple mb-6">
                  <SimpleShieldIcon />
                </div>
                <h3 className="h3 mb-4">Smart Alerts</h3>
                <p className="text-muted mb-6">
                  Intelligent alert system with priority classification, automated 
                  notifications, resolution tracking, and escalation protocols.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <span className="badge badge-warning">Auto Alerts</span>
                  <span className="badge badge-secondary">Priority System</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="section">
        <div className="container">
          <div className="card">
            <div className="card-header bg-gradient">
              <h2 className="h2">Dashboard Features</h2>
              <p className="text-muted">Complete IoT platform functionality in a modern interface</p>
            </div>
            <div className="card-body">
              <div className="grid grid-2 gap-8">
                <div>
                  <h3 className="h3 mb-4">Core Capabilities</h3>
                  <div className="flex flex-col gap-3">
                    {[
                      'Real-time sensor data monitoring',
                      'Multi-location device management',
                      'Intelligent alert prioritization',
                      'System health monitoring',
                      'Battery level tracking'
                    ].map((feature, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="h3 mb-4">Technical Stack</h3>
                  <div className="flex flex-col gap-3">
                    {[
                      'Next.js 15 with React 19',
                      'Pure CSS design system',
                      'TypeScript implementation',
                      'Responsive design patterns',
                      'Professional component architecture'
                    ].map((tech, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span>{tech}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="section bg-light">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="h2">Platform Statistics</h2>
            <p className="text-large text-muted">Real-world deployment metrics and capabilities</p>
          </div>
          
          <div className="grid grid-4 gap-6">
            <div className="card text-center">
              <div className="card-body">
                <div className="metric-value text-blue">15+</div>
                <div className="text-medium font-semibold mb-2">Sensor Types</div>
                <div className="text-sm text-muted">Temperature, Humidity, Motion, Light, Pressure</div>
              </div>
            </div>
            <div className="card text-center">
              <div className="card-body">
                <div className="metric-value text-green">5</div>
                <div className="text-medium font-semibold mb-2">Active Locations</div>
                <div className="text-sm text-muted">Building A, B, C, Laboratory, Warehouse</div>
              </div>
            </div>
            <div className="card text-center">
              <div className="card-body">
                <div className="metric-value text-purple">99.8%</div>
                <div className="text-medium font-semibold mb-2">System Uptime</div>
                <div className="text-sm text-muted">30-day average with redundancy</div>
              </div>
            </div>
            <div className="card text-center">
              <div className="card-body">
                <div className="metric-value text-yellow">24/7</div>
                <div className="text-medium font-semibold mb-2">Live Monitoring</div>
                <div className="text-sm text-muted">Real-time alerts and notifications</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section bg-gradient">
        <div className="container text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="h2 text-white mb-4">Experience the Full Dashboard</h2>
            <p className="text-large text-light mb-8">
              Explore all features including real-time data updates, interactive components, 
              and comprehensive IoT management tools.
            </p>
            <Link href="/dashboard" className="btn btn-light btn-lg">
              <div className="icon-container icon-sm mr-2">
                <SimpleRocketLaunchIcon />
              </div>
              Launch Dashboard
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
