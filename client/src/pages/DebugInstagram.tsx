/**
 * Debug Instagram Post Page
 * Test Instagram posting with step-by-step screenshots
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Camera, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function DebugInstagram() {
  const [deviceId, setDeviceId] = useState('');
  const [content, setContent] = useState('Debug test post from SNS Marketing Automation');
  const [mediaUrl, setMediaUrl] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const debugMutation = trpc.debug.instagramPost.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setIsRunning(false);
      if (data.success) {
        toast.success('Debug test completed successfully');
      } else {
        toast.error(`Debug test failed at ${data.failedAt}`);
      }
    },
    onError: (error) => {
      setIsRunning(false);
      toast.error(`Debug test failed: ${error.message}`);
    },
  });

  const handleRunDebug = () => {
    if (!deviceId.trim()) {
      toast.error('Please enter a device ID');
      return;
    }
    if (!content.trim()) {
      toast.error('Please enter content');
      return;
    }

    setIsRunning(true);
    setResult(null);
    debugMutation.mutate({
      deviceId: deviceId.trim(),
      content: content.trim(),
      mediaUrl: mediaUrl.trim() || undefined,
    });
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Debug Instagram Post</h1>
        <p className="text-muted-foreground mt-2">
          Test Instagram posting process with step-by-step screenshots to identify issues
        </p>
      </div>

      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle>Test Parameters</CardTitle>
          <CardDescription>Enter device ID and content to test Instagram posting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Device ID</label>
            <Input
              placeholder="e.g., s0t85, x647M"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              disabled={isRunning}
            />
            <p className="text-xs text-muted-foreground mt-1">
              The DuoPlus device ID (without "snap_" prefix)
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Content</label>
            <Textarea
              placeholder="Enter test content..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isRunning}
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Media URL (Optional)</label>
            <Input
              placeholder="https://example.com/image.jpg"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              disabled={isRunning}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty to test with existing media on device
            </p>
          </div>

          <Button onClick={handleRunDebug} disabled={isRunning} className="w-full">
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Debug Test...
              </>
            ) : (
              <>
                <Camera className="mr-2 h-4 w-4" />
                Run Debug Test
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Test Completed Successfully
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  Test Failed
                </>
              )}
            </CardTitle>
            <CardDescription>
              {result.deviceResolution && (
                <span>
                  Device Resolution: {result.deviceResolution.width}x{result.deviceResolution.height}
                </span>
              )}
              {result.failedAt && (
                <span className="text-red-500 ml-4">Failed at: {result.failedAt}</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Test Steps ({Array.isArray(result.steps) ? result.steps.length : 0})</h3>
                <div className="space-y-3">
                  {Array.isArray(result.steps) && result.steps.map((step: any, index: number) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            <Badge variant={step.error ? 'destructive' : 'default'}>
                              Step {step.stepNumber}
                            </Badge>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium">{step.step}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {step.description}
                            </p>
                            {step.error && (
                              <div className="flex items-center gap-2 mt-2 text-red-500">
                                <AlertCircle className="h-4 w-4" />
                                <span className="text-sm">
                                  {typeof step.error === 'string' ? step.error : JSON.stringify(step.error)}
                                </span>
                              </div>
                            )}
                            {step.screenshotUrl && (
                              <div className="mt-3">
                                <a
                                  href={step.screenshotUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-500 hover:underline"
                                >
                                  View Screenshot →
                                </a>
                                <div className="mt-2 border rounded-lg overflow-hidden">
                                  <img
                                    src={step.screenshotUrl}
                                    alt={`Screenshot for ${step.step}`}
                                    className="w-full h-auto"
                                  />
                                </div>
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(step.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {result.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 mb-2">Error Details</h4>
                  <p className="text-sm text-red-700">
                    {typeof result.error === 'string' ? result.error : JSON.stringify(result.error)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
