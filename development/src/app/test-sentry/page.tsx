'use client';

import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

export default function TestSentryPage() {
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [sentryInitialized, setSentryInitialized] = useState(false);

  useEffect(() => {
    // Check if Sentry is initialized
    const client = Sentry.getClient();
    setSentryInitialized(!!client);
    addLog(`Sentry Client: ${client ? 'Initialized ✅' : 'Not Initialized ❌'}`);
    addLog(`DSN: ${process.env.NEXT_PUBLIC_SENTRY_DSN ? 'Configured ✅' : 'Missing ❌'}`);
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[Sentry Test] ${message}`);
  };

  const triggerError = () => {
    addLog('🧪 Attempting to send test error...');
    try {
      throw new Error('🧪 Test Error: Sentry is working! This is a deliberate test error.');
    } catch (error) {
      addLog('📤 Calling Sentry.captureException()...');
      const eventId = Sentry.captureException(error);
      setLastEventId(eventId);
      addLog(`✅ Event ID received: ${eventId}`);
      addLog('🔍 Check browser console for Sentry debug logs');
      addLog('🌐 Check Network tab for requests to sentry.io');
      alert(`Test error sent to Sentry!\n\nEvent ID: ${eventId}\n\nCheck:\n1. Browser Console for Sentry logs\n2. Network tab for sentry.io requests\n3. Sentry dashboard`);
    }
  };

  const triggerUnhandledError = () => {
    // This will be caught automatically by Sentry
    throw new Error('🚨 Unhandled Error: This error should appear in Sentry automatically!');
  };

  const triggerMessage = () => {
    const eventId = Sentry.captureMessage('📝 Test Message: This is a test message from the Sentry test page', 'info');
    setLastEventId(eventId);
    alert(`Test message sent to Sentry! Event ID: ${eventId}`);
  };

  const triggerWarning = () => {
    const eventId = Sentry.captureMessage('⚠️ Test Warning: This is a test warning', 'warning');
    setLastEventId(eventId);
    alert(`Warning sent to Sentry! Event ID: ${eventId}`);
  };

  const triggerWithContext = () => {
    Sentry.setContext('test_context', {
      testType: 'manual_trigger',
      timestamp: new Date().toISOString(),
      userAction: 'button_click',
    });
    
    Sentry.setTag('test_tag', 'context_test');
    
    try {
      throw new Error('🎯 Error with Custom Context: This error includes custom context and tags');
    } catch (error) {
      const eventId = Sentry.captureException(error);
      setLastEventId(eventId);
      alert(`Error with context sent! Event ID: ${eventId}\nCheck Sentry for custom context and tags.`);
    }
  };

  const triggerBreadcrumbs = () => {
    // Add custom breadcrumbs
    Sentry.addBreadcrumb({
      category: 'test',
      message: 'User started breadcrumb test',
      level: 'info',
    });

    Sentry.addBreadcrumb({
      category: 'navigation',
      message: 'User clicked test button',
      level: 'info',
    });

    Sentry.addBreadcrumb({
      category: 'user_action',
      message: 'About to trigger error with breadcrumbs',
      level: 'warning',
    });

    try {
      throw new Error('🍞 Error with Breadcrumbs: Check Sentry to see the breadcrumb trail');
    } catch (error) {
      const eventId = Sentry.captureException(error);
      setLastEventId(eventId);
      alert(`Error with breadcrumbs sent! Event ID: ${eventId}`);
    }
  };

  const openUserFeedback = () => {
    if (lastEventId) {
      Sentry.showReportDialog({
        eventId: lastEventId,
        title: 'It looks like we encountered an issue',
        subtitle: 'Our team has been notified. Please provide additional details below.',
        subtitle2: '',
        labelName: 'Name',
        labelEmail: 'Email',
        labelComments: 'What happened?',
        labelClose: 'Close',
        labelSubmit: 'Submit',
      });
    } else {
      alert('Please trigger an error first to get an event ID!');
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">🔍 Sentry Error Tracking Test</h1>
      
      <div className="space-y-4">
        <div className="p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-2">✅ Sentry Configuration</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Sentry Client:</strong> {sentryInitialized ? '✅ Initialized' : '❌ Not Initialized'}</p>
            <p><strong>DSN Configured:</strong> {process.env.NEXT_PUBLIC_SENTRY_DSN ? '✅ Yes' : '❌ No'}</p>
            <p><strong>DSN:</strong> <code className="text-xs bg-gray-100 p-1 rounded">{process.env.NEXT_PUBLIC_SENTRY_DSN?.substring(0, 50)}...</code></p>
            <p><strong>Environment:</strong> {process.env.NODE_ENV}</p>
            {lastEventId && (
              <p><strong>Last Event ID:</strong> <code className="text-xs bg-green-100 p-1 rounded">{lastEventId}</code></p>
            )}
          </div>
        </div>

        <div className="p-4 border rounded-lg bg-gray-50">
          <h2 className="text-xl font-semibold mb-2">📋 Activity Log</h2>
          <div className="text-xs font-mono bg-black text-green-400 p-3 rounded max-h-48 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">No activity yet...</p>
            ) : (
              logs.map((log, idx) => (
                <div key={idx}>{log}</div>
              ))
            )}
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

        <div className="p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-2">📝 Test 3: Messages & Warnings</h2>
          <p className="text-sm text-gray-600 mb-4">
            Test different severity levels of messages
          </p>
          <div className="flex gap-2">
            <Button onClick={triggerMessage} variant="outline">
              Send Info Message
            </Button>
            <Button onClick={triggerWarning} variant="outline">
              Send Warning
            </Button>
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-2">🎯 Test 4: Error with Context</h2>
          <p className="text-sm text-gray-600 mb-4">
            Send error with custom context, tags, and user data
          </p>
          <Button onClick={triggerWithContext} variant="outline">
            Trigger Error with Context
          </Button>
        </div>

        <div className="p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-2">🍞 Test 5: Error with Breadcrumbs</h2>
          <p className="text-sm text-gray-600 mb-4">
            Send error with custom breadcrumb trail showing user actions
          </p>
          <Button onClick={triggerBreadcrumbs} variant="outline">
            Trigger Error with Breadcrumbs
          </Button>
        </div>

        <div className="p-4 border rounded-lg">
          <h2 className="text-xl font-semibold mb-2">💬 Test 6: User Feedback</h2>
          <p className="text-sm text-gray-600 mb-4">
            Open user feedback dialog (requires an event ID from a previous test)
          </p>
          <Button 
            onClick={openUserFeedback} 
            variant="outline"
            disabled={!lastEventId}
          >
            Open Feedback Dialog
          </Button>
          {!lastEventId && (
            <p className="text-xs text-gray-500 mt-2">Trigger an error first to enable this</p>
          )}
        </div>

        <div className="p-4 border rounded-lg bg-blue-50">
          <h2 className="text-xl font-semibold mb-2">📊 Check Results</h2>
          <p className="text-sm mb-2">After triggering errors, check your Sentry dashboard:</p>
          <ol className="text-sm list-decimal list-inside space-y-1">
            <li>Go to <a href="https://sentry.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">sentry.io</a></li>
            <li>Navigate to your project</li>
            <li>Click &quot;Issues&quot; in the sidebar</li>
            <li>You should see the test errors appear within seconds</li>
            <li>Click on an issue to see breadcrumbs, context, and tags</li>
          </ol>
        </div>

        <div className="p-4 border rounded-lg bg-green-50">
          <h2 className="text-xl font-semibold mb-2">✅ What to Look For</h2>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li><strong>Event captured:</strong> Error appears in Sentry Issues</li>
            <li><strong>Environment:</strong> Correct environment tag (development/production)</li>
            <li><strong>Breadcrumbs:</strong> Trail of user actions before error</li>
            <li><strong>Context:</strong> Custom context data attached to events</li>
            <li><strong>Tags:</strong> Custom tags for filtering and searching</li>
            <li><strong>Stack trace:</strong> Full error stack with source maps</li>
            <li><strong>User info:</strong> User context if authenticated</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
