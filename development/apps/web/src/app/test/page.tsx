'use client';

import React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function TestPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-gray-50 border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium">
              ← Back to Home
            </Link>
            <span className="text-gray-400">|</span>
            <h1 className="text-xl font-semibold text-gray-900">IoT Dashboard Test</h1>
          </div>
          <Link 
            href="/dashboard"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            View Full Dashboard
          </Link>
        </div>
      </nav>

      <div className="p-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Test Environment</h2>
          <p className="text-gray-600">Simple test interface for verifying IoT sensor connections and API functionality.</p>
        </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Test Card 1 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Temperature Sensor</h3>
          <p className="text-3xl font-bold text-blue-600">22.5°C</p>
          <p className="text-sm text-blue-700">Status: Online</p>
        </div>

        {/* Test Card 2 */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-2">Humidity Sensor</h3>
          <p className="text-3xl font-bold text-green-600">65.2%</p>
          <p className="text-sm text-green-700">Status: Online</p>
        </div>

        {/* Test Card 3 */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Pressure Sensor</h3>
          <p className="text-3xl font-bold text-red-600">1013.25 hPa</p>
          <p className="text-sm text-red-700">Status: Alert</p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">API Test</h2>
        <button 
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          onClick={async () => {
            try {
              const supabase = createClient();
              
              if (!supabase) {
                console.log('⚠️ Supabase not configured - running in demo mode');
                alert('Supabase not configured - app running in demo mode');
                return;
              }
              
              const { data, error } = await supabase
                .from('sensors')
                .select('*')
                .order('name');
              
              if (error) {
                console.error('Supabase Error:', error);
                alert('Supabase Error - check console');
              } else {
                console.log('Supabase Response:', data);
                alert('Check console for Supabase response');
              }
            } catch (error) {
              console.error('Connection Error:', error);
              alert('Connection Error - check console');
            }
          }}
        >
          Test Supabase Connection
        </button>
      </div>
      </div>
    </div>
  );
}
