/**
 * Debug X Web Posting Page
 * Test X web posting with step-by-step screenshots
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, Image as ImageIcon } from 'lucide-react';


export default function DebugXWeb() {
  const [deviceId, setDeviceId] = useState('');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [result, setResult] = useState<any>(null);

  const debugMutation = trpc.debug.xWebPost.useMutation({
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (error) => {
      setResult({
        success: false,
        error: error.message,
        screenshots: [],
      });
    },
  });

  const handleRunTest = () => {
    if (!deviceId || !content) {
      alert('Please enter Device ID and Content');
      return;
    }

    setResult(null);
    debugMutation.mutate({
      deviceId,
      content,
      mediaUrl: mediaUrl || undefined,
    });
  };

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">X Web Posting Debug</h1>
        <p className="text-muted-foreground">
          Test X web posting with step-by-step screenshots to identify issues
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
            <CardDescription>
              Enter device ID and post content to test the posting process
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Device ID</label>
              <Input
                placeholder="e.g., s0t85"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter the DuoPlus device ID (without snap_ prefix)
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Post Content</label>
              <Textarea
                placeholder="Enter your post content here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Media URL (Optional)</label>
              <Input
                placeholder="https://example.com/image.jpg"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Media upload not yet implemented
              </p>
            </div>

            <Button
              onClick={handleRunTest}
              disabled={debugMutation.isPending || !deviceId || !content}
              className="w-full"
            >
              {debugMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Test...
                </>
              ) : (
                'Run Debug Test'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              View the results and screenshots from the test
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!result && !debugMutation.isPending && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No test results yet</p>
                <p className="text-sm mt-2">Run a test to see results here</p>
              </div>
            )}

            {debugMutation.isPending && (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Running test...</p>
                <p className="text-sm text-muted-foreground mt-2">
                  This may take 30-60 seconds
                </p>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                {/* Status */}
                <Alert variant={result.success ? 'default' : 'destructive'}>
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                    <AlertDescription>
                      {result.success ? (
                        <span className="font-medium">Test Passed</span>
                      ) : (
                        <span className="font-medium">Test Failed</span>
                      )}
                    </AlertDescription>
                  </div>
                </Alert>

                {/* Login Status */}
                {result.loginStatus !== undefined && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-1">Login Status</p>
                    <p className="text-sm text-muted-foreground">
                      {result.loginStatus ? (
                        <span className="text-green-600">✓ Logged in</span>
                      ) : (
                        <span className="text-red-600">✗ Not logged in</span>
                      )}
                    </p>
                  </div>
                )}

                {/* Error Message */}
                {result.error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm font-medium mb-1 text-destructive">Error</p>
                    <p className="text-sm text-destructive/90">{result.error}</p>
                  </div>
                )}

                {/* Screenshots Count */}
                {result.screenshots && result.screenshots.length > 0 && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-1">Screenshots Captured</p>
                    <p className="text-sm text-muted-foreground">
                      {result.screenshots.length} screenshots saved
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Screenshots Section */}
      {result && result.screenshots && result.screenshots.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Step-by-Step Screenshots</CardTitle>
            <CardDescription>
              View screenshots from each step of the posting process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {result.screenshots.map((screenshot: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">{screenshot.step}</p>
                  </div>
                  <div className="bg-muted rounded p-2 text-xs text-muted-foreground break-all">
                    {screenshot.url}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Screenshot saved on device
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>How to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-medium mb-1">1. Prepare Device</p>
            <p className="text-muted-foreground">
              Make sure the device is powered on and X is accessible
            </p>
          </div>
          <div>
            <p className="font-medium mb-1">2. Login to X</p>
            <p className="text-muted-foreground">
              Manually login to X on the device's Chrome browser first
            </p>
          </div>
          <div>
            <p className="font-medium mb-1">3. Run Test</p>
            <p className="text-muted-foreground">
              Enter device ID and post content, then click "Run Debug Test"
            </p>
          </div>
          <div>
            <p className="font-medium mb-1">4. Review Results</p>
            <p className="text-muted-foreground">
              Check the screenshots to see where the process succeeded or failed
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
