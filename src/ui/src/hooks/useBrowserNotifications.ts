import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { chatService } from '../services/chat';
import { httpClient } from '../services/httpClient';
import { webhookService } from '../services/webhooks';

const LAST_SEEN_KEY = 'morpheus.chat.lastSeenAt';
const UI_SESSION_KEY = 'morpheus.chat.uiSessionId';
const CHRONOS_SEEN_KEY = 'morpheus.chronos.lastSeenAt';
const WEBHOOK_SEEN_KEY = 'morpheus.webhook.lastSeenAt';

const MSG_POLL_INTERVAL = 5000;
const CHRONOS_POLL_INTERVAL = 10_000;
const WEBHOOK_POLL_INTERVAL = 10_000;

export function useBrowserNotifications() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const lastSeenAtRef = useRef<number>(0);
  const chronosLastSeenRef = useRef<number>(0);
  const webhookLastSeenRef = useRef<number>(0);

  // Initialize timestamps from sessionStorage
  useEffect(() => {
    const savedMsg = sessionStorage.getItem(LAST_SEEN_KEY);
    lastSeenAtRef.current = savedMsg ? parseInt(savedMsg, 10) : Date.now();
    if (!savedMsg) sessionStorage.setItem(LAST_SEEN_KEY, String(lastSeenAtRef.current));

    const savedChronos = sessionStorage.getItem(CHRONOS_SEEN_KEY);
    chronosLastSeenRef.current = savedChronos ? parseInt(savedChronos, 10) : Date.now();
    if (!savedChronos) sessionStorage.setItem(CHRONOS_SEEN_KEY, String(chronosLastSeenRef.current));

    const savedWebhook = sessionStorage.getItem(WEBHOOK_SEEN_KEY);
    webhookLastSeenRef.current = savedWebhook ? parseInt(savedWebhook, 10) : Date.now();
    if (!savedWebhook) sessionStorage.setItem(WEBHOOK_SEEN_KEY, String(webhookLastSeenRef.current));
  }, []);

  // Request browser notification permission on first load
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // While on /chat, keep lastSeenAt current so we don't re-notify for messages already seen
  useEffect(() => {
    if (location.pathname !== '/chat') return;
    const update = () => {
      const now = Date.now();
      lastSeenAtRef.current = now;
      sessionStorage.setItem(LAST_SEEN_KEY, String(now));
    };
    update();
    const id = setInterval(update, 3000);
    return () => clearInterval(id);
  }, [location.pathname]);

  // When away from /chat, poll the UI session for new AI messages
  useEffect(() => {
    if (location.pathname === '/chat') return;
    if (!('Notification' in window)) return;

    const check = async () => {
      if (Notification.permission !== 'granted') return;

      // Only notify for the session the user interacted with via the UI
      const uiSessionId = sessionStorage.getItem(UI_SESSION_KEY);
      if (!uiSessionId) return;

      try {
        const messages = await chatService.getMessages(uiSessionId);
        const latest = messages.filter(m => m.type === 'ai' && m.content).at(-1);
        if (!latest?.created_at || latest.created_at <= lastSeenAtRef.current) return;

        lastSeenAtRef.current = latest.created_at;
        sessionStorage.setItem(LAST_SEEN_KEY, String(latest.created_at));

        const body = latest.content.replace(/[#*`[\]]/g, '').trim().slice(0, 120);
        const notif = new Notification('Morpheus', {
          body: body || 'Nova resposta do agente',
          tag: 'morpheus-chat',
          requireInteraction: true,
        });
        notif.onclick = () => {
          window.focus();
          navigateRef.current('/chat');
          notif.close();
        };
      } catch {
        // silent
      }
    };

    check();
    const id = setInterval(check, MSG_POLL_INTERVAL);
    return () => clearInterval(id);
  }, [location.pathname]);

  // Always poll webhook notifications for completed ones (regardless of current page)
  useEffect(() => {
    if (!('Notification' in window)) return;

    const checkWebhooks = async () => {
      if (Notification.permission !== 'granted') return;
      try {
        const notifications = await webhookService.listNotifications({ unreadOnly: true });
        // Only care about completed ones with a result
        const completed = notifications.filter(n => n.status === 'completed');
        if (!completed.length) return;

        // Find the most recent completion timestamp
        const latest = completed.reduce((best, n) => {
          const ts = n.completed_at ?? n.created_at;
          const bestTs = best.completed_at ?? best.created_at;
          return ts > bestTs ? n : best;
        });
        const latestTs = latest.completed_at ?? latest.created_at;
        if (latestTs <= webhookLastSeenRef.current) return;

        webhookLastSeenRef.current = latestTs;
        sessionStorage.setItem(WEBHOOK_SEEN_KEY, String(latestTs));

        const body = latest.result
          ? latest.result.replace(/[#*`[\]]/g, '').trim().slice(0, 120)
          : `Webhook: ${latest.webhook_name}`;
        const notif = new Notification(`Morpheus — Webhook ✓`, {
          body,
          tag: 'morpheus-webhook',
          requireInteraction: true,
        });
        notif.onclick = () => {
          window.focus();
          navigateRef.current('/notifications');
          notif.close();
        };
      } catch {
        // silent
      }
    };

    checkWebhooks();
    const id = setInterval(checkWebhooks, WEBHOOK_POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  // Always poll Chronos for completed executions (regardless of current page)
  useEffect(() => {
    if (!('Notification' in window)) return;

    const checkChronos = async () => {
      if (Notification.permission !== 'granted') return;
      try {
        const since = chronosLastSeenRef.current;
        const executions = await httpClient.get<Array<{
          id: string;
          job_id: string;
          completed_at: number;
          status: string;
          job_prompt: string;
        }>>(`/chronos/executions/recent?since=${since}`);

        if (!executions.length) return;

        // Find the most recent completion
        const latest = executions[0];
        if (latest.completed_at <= chronosLastSeenRef.current) return;

        chronosLastSeenRef.current = latest.completed_at;
        sessionStorage.setItem(CHRONOS_SEEN_KEY, String(latest.completed_at));

        const statusEmoji = latest.status === 'success' ? '✓' : '✗';
        const promptPreview = latest.job_prompt.slice(0, 80);
        const notif = new Notification(`Morpheus — Chronos ${statusEmoji}`, {
          body: promptPreview || 'Job executado',
          tag: 'morpheus-chronos',
          requireInteraction: true,
        });
        notif.onclick = () => {
          window.focus();
          navigateRef.current('/chronos');
          notif.close();
        };
      } catch {
        // silent
      }
    };

    checkChronos();
    const id = setInterval(checkChronos, CHRONOS_POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);
}
