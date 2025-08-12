import React from 'react';
import Link from 'next/link';
import Navigation from '../components/ui/Navigation';
import { SimplePlayIcon, SimpleChartIcon, SimpleBuildingIcon, SimpleWifiIcon } from '../components/icons/SimpleIcons';

export default function Home() {
  return (
    <div className="page">
      <Navigation currentPage="home" />

      {/* Hero Section */}
      <div className="section">
        <div className="container">
          <div className="text-center mb-8">
            <h1>NetNeural Dashboard</h1>
            <p className="text-large">Network management and IoT monitoring simplified</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-3 mb-8">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3>Active Devices</h3>
                <div className="icon-container icon-sm icon-bg-blue">
                  <SimpleBuildingIcon />
                </div>
              </div>
              <div className="metric-value metric-info">24</div>
              <p>Connected to network</p>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3>Network Status</h3>
                <div className="icon-container icon-sm icon-bg-green">
                  <SimpleWifiIcon />
                </div>
              </div>
              <div className="metric-value metric-success">Online</div>
              <p>All systems operational</p>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3>Data Transfer</h3>
                <div className="icon-container icon-sm icon-bg-amber">
                  <SimpleChartIcon />
                </div>
              </div>
              <div className="metric-value metric-warning">2.4GB</div>
              <p>Last 24 hours</p>
            </div>
          </div>

          {/* Main Features */}
          <div className="grid grid-2">
            <div className="card">
              <div className="flex items-center gap-4 mb-4">
                <div className="icon-container icon-md icon-bg-blue">
                  <SimplePlayIcon />
                </div>
                <h3>Quick Start</h3>
              </div>
              <p className="mb-4">Get started with NetNeural network management in minutes.</p>
              <Link href="/dashboard" className="btn btn-primary">
                Launch Dashboard
              </Link>
            </div>

            <div className="card">
              <div className="flex items-center gap-4 mb-4">
                <div className="icon-container icon-md icon-bg-green">
                  <SimpleChartIcon />
                </div>
                <h3>Analytics</h3>
              </div>
              <p className="mb-4">View detailed network performance and usage analytics.</p>
              <Link href="/mvp" className="btn btn-primary">
                View Analytics
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
