/**
 * React hook for real-time WebSocket events
 *
 * Usage:
 *   const { lastEvent, isConnected } = useRealtimeEvents();
 *   useRealtimeEvents({
 *     onEvent: (event) => {
 *       if (event.type === 'post:published') {
 *         utils.scheduledPosts.list.invalidate();
 *       }
 *     }
 *   });
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type EventType =
  | 'post:created'
  | 'post:published'
  | 'post:failed'
  | 'engagement:received'
  | 'account:status-changed'
  | 'analytics:updated'
  | 'agent:execution-completed'
  | 'automation:task-completed'
  | 'notification:new';

export type RealtimeEvent = {
  type: EventType;
  data: Record<string, unknown>;
  userId?: number;
  timestamp: string;
};

type UseRealtimeEventsOptions = {
  onEvent?: (event: RealtimeEvent) => void;
  enabled?: boolean;
};

export function useRealtimeEvents(options: UseRealtimeEventsOptions = {}) {
  const { onEvent, enabled = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/events`);

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as RealtimeEvent;
        setLastEvent(parsed);
        onEventRef.current?.(parsed);
      } catch {
        // Invalid message, ignore
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      // Reconnect after 3 seconds
      if (enabled) {
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, enabled]);

  return { isConnected, lastEvent };
}
