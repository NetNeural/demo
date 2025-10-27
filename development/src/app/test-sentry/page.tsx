'use client';

import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';

export default function TestSentryPage() {
  const triggerError = () => {
    try {
      throw new Error('🧪 Test Error: Sentry is working! This is a deliberate test error.');
    } catch (error) {
      Sentry.captureException(error);
      alert('Test error sent to Sentry! Check your Sentry dashboard.');
    }
  };

  const triggerUnhandledError = () => {
    // This will be caught automatically by Sentry
    throw new Error('🚨 Unhandled Error: This error should appear in Sentry automatically!');
  };

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">🔍 Sentry Error Tracking Test</h1>
      
      <div className="space-y-4">
        <div className="p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-2">✅ Sentry Configuration</h2>
          <div className="space-y-2 text-sm">
            <p><strong>DSN Configured:</strong> {process.env.NEXT_PUBLIC_SENTRY_DSN ? '✅ Yes' : '❌ No'}</p>
            <p><strong>DSN:</strong> <code className="text-xs bg-gray-100 p-1 rounded">{process.env.NEXT_PUBLIC_SENTRY_DSN?.substring(0, 50)}...</code></p>
            <p><strong>Environment:</strong> {process.env.NODE_ENV}</p>
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-2">🧪 Test 1: Manual Error Capture</h2>
          <p className="text-sm text-gray-600 mb-4">
            This test manually captures an error and sends it to Sentry using <code>Sentry.captureException()</code>
          </p>
          <Button onClick={triggerError} variant="outline">
            Send Test Error to Sentry
          </Button>
        </div>

        <div className="p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-2">🚨 Test 2: Unhandled Error</h2>
          <p className="text-sm text-gray-600 mb-4">
            This test throws an unhandled error that Sentry should catch automatically
          </p>
          <Button onClick={triggerUnhandledError} variant="destructive">
            Trigger Unhandled Error
          </Button>
        </div>

        <div className="p-4 border rounded-lg bg-blue-50">
          <h2 className="text-xl font-semibold mb-2">📊 Check Results</h2>
          <p className="text-sm mb-2">After triggering errors, check your Sentry dashboard:</p>
          <ol className="text-sm list-decimal list-inside space-y-1">
            <li>Go to <a href="https://sentry.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">sentry.io</a></li>
            <li>Navigate to your project</li>
            <li>Click &quot;Issues&quot; in the sidebar</li>
            <li>You should see the test errors appear within seconds</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
