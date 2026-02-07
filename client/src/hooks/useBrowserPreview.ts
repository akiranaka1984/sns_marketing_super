import { useEffect, useRef, useState, useCallback } from 'react';

export interface BrowserPreviewState {
  imageUrl: string | null;
  status: 'connecting' | 'streaming' | 'idle' | 'disconnected';
  operationStep: string | null;
  operationType: string | null;
}

/**
 * Custom hook for connecting to the Playwright screencast WebSocket
 * and managing the live preview image URL.
 */
export function useBrowserPreview(
  accountId: number,
  enabled: boolean
): BrowserPreviewState {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<BrowserPreviewState['status']>('disconnected');
  const [operationStep, setOperationStep] = useState<string | null>(null);
  const [operationType, setOperationType] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const prevUrlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    }
    setImageUrl(null);
    setStatus('disconnected');
    setOperationStep(null);
    setOperationType(null);
  }, []);

  useEffect(() => {
    if (!enabled || !accountId) {
      cleanup();
      return;
    }

    setStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/playwright-preview?accountId=${accountId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      setStatus('connecting');
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        // Binary frame data - create blob URL
        const blob = new Blob([event.data], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);

        // Revoke previous URL to prevent memory leak
        if (prevUrlRef.current) {
          URL.revokeObjectURL(prevUrlRef.current);
        }
        prevUrlRef.current = url;
        setImageUrl(url);
        setStatus('streaming');
      } else {
        // Text message - JSON status
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'status') {
            if (msg.status === 'streaming') {
              setStatus('streaming');
            } else if (msg.status === 'idle') {
              setStatus('idle');
            }
          } else if (msg.type === 'operation') {
            setOperationType(msg.operation || null);
            setOperationStep(msg.step || null);
          }
        } catch {
          // Ignore parse errors
        }
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    ws.onerror = () => {
      setStatus('disconnected');
    };

    return () => {
      cleanup();
    };
  }, [accountId, enabled, cleanup]);

  return { imageUrl, status, operationStep, operationType };
}
