import { useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import {
  Bell,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Eye,
  CheckCheck,
  ArrowLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { webhookService, type WebhookNotification } from '../services/webhooks';
import { Dialog, DialogHeader, DialogTitle } from '../components/Dialog';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const StatusBadge = ({ status }: { status: WebhookNotification['status'] }) => {
  if (status === 'completed') {
    return (
      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
        <CheckCircle2 className="w-4 h-4" />
        <span className="text-xs">Completed</span>
      </div>
    );
  }
  if (status === 'failed') {
    return (
      <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
        <XCircle className="w-4 h-4" />
        <span className="text-xs">Failed</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400">
      <Clock className="w-4 h-4 animate-pulse" />
      <span className="text-xs">Pending</span>
    </div>
  );
};

const formatDate = (ts: number) =>
  new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const prettyJson = (str: string) => {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
};

export const Notifications = () => {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [detail, setDetail] = useState<WebhookNotification | null>(null);

  const { data: notifications = [], mutate } = useSWR(
    ['/webhooks/notifications', unreadOnly],
    () => webhookService.listNotifications({ unreadOnly }),
    { refreshInterval: 5_000 },
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    await webhookService.markRead(ids);
    await mutate();
  };

  const handleMarkAllRead = () => {
    const unread = notifications.filter((n) => !n.read).map((n) => n.id);
    handleMarkRead(unread);
  };

  const openDetail = async (n: WebhookNotification) => {
    setDetail(n);
    if (!n.read) {
      await handleMarkRead([n.id]);
    }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-6 h-6 text-azure-primary dark:text-matrix-highlight" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-azure-text-primary dark:text-matrix-highlight">
              Notifications
            </h1>
            <p className="text-sm text-azure-text-secondary dark:text-matrix-dim mt-0.5">
              Webhook execution results from the Apoc agent.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to="/webhooks"
            className="flex items-center gap-2 text-sm text-azure-text-secondary dark:text-matrix-dim hover:text-azure-primary dark:hover:text-matrix-highlight transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Webhooks
          </Link>

          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
              unreadOnly
                ? 'border-azure-primary dark:border-matrix-highlight bg-azure-active dark:bg-matrix-primary/20 text-azure-primary dark:text-matrix-highlight'
                : 'border-azure-border dark:border-matrix-primary text-azure-text-secondary dark:text-matrix-dim hover:bg-azure-surface dark:hover:bg-zinc-800'
            }`}
          >
            <Filter className="w-4 h-4" />
            Unread only
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-azure-border dark:border-matrix-primary text-sm text-azure-text-secondary dark:text-matrix-dim hover:bg-azure-surface dark:hover:bg-zinc-800 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        variants={item}
        className="rounded-lg border border-azure-border dark:border-matrix-primary overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-azure-surface dark:bg-zinc-900 border-b border-azure-border dark:border-matrix-primary">
              <tr>
                {['', 'Webhook', 'Status', 'Created', 'Completed', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left font-semibold text-azure-text-secondary dark:text-matrix-dim"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-azure-text-secondary dark:text-matrix-dim">
                    {unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}
                  </td>
                </tr>
              ) : (
                notifications.map((n) => (
                  <tr
                    key={n.id}
                    className={`border-b border-azure-border dark:border-matrix-primary/30 hover:bg-azure-surface/50 dark:hover:bg-zinc-800/50 transition-colors ${
                      !n.read ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    {/* Unread indicator */}
                    <td className="px-4 py-3 w-6">
                      {!n.read && (
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-500 dark:bg-matrix-highlight" />
                      )}
                    </td>

                    {/* Webhook name */}
                    <td className="px-4 py-3 font-mono font-medium text-azure-text-primary dark:text-matrix-text">
                      {n.webhook_name}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={n.status} />
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3 text-xs text-azure-text-secondary dark:text-matrix-dim whitespace-nowrap">
                      {formatDate(n.created_at)}
                    </td>

                    {/* Completed */}
                    <td className="px-4 py-3 text-xs text-azure-text-secondary dark:text-matrix-dim whitespace-nowrap">
                      {n.completed_at ? formatDate(n.completed_at) : '—'}
                    </td>

                    {/* View */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openDetail(n)}
                        title="View details"
                        className="p-1.5 rounded hover:bg-azure-border dark:hover:bg-matrix-primary/30 text-azure-text-secondary dark:text-matrix-dim hover:text-azure-primary dark:hover:text-matrix-highlight transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Detail Modal */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogHeader>
          <DialogTitle className="text-azure-text-primary dark:text-matrix-highlight flex items-center gap-2">
            <Bell className="w-4 h-4" />
            {detail?.webhook_name}
          </DialogTitle>
        </DialogHeader>
        {detail && (
          <div className="p-6 space-y-4 overflow-y-auto max-h-[65vh]">
            {/* Meta */}
            <div className="flex items-center gap-4 text-xs text-azure-text-secondary dark:text-matrix-dim">
              <StatusBadge status={detail.status} />
              <span>{formatDate(detail.created_at)}</span>
              {detail.completed_at && (
                <span>→ {formatDate(detail.completed_at)}</span>
              )}
            </div>

            {/* Payload */}
            <div>
              <p className="text-sm font-medium text-azure-text-secondary dark:text-matrix-dim mb-1.5">
                Received Payload
              </p>
              <pre className="bg-azure-bg dark:bg-zinc-950 rounded-lg p-3 text-xs font-mono overflow-auto max-h-44 text-azure-text-primary dark:text-matrix-text border border-azure-border dark:border-matrix-primary/30 whitespace-pre-wrap">
                {prettyJson(detail.payload)}
              </pre>
            </div>

            {/* Result */}
            <div>
              <p className="text-sm font-medium text-azure-text-secondary dark:text-matrix-dim mb-1.5">
                Agent Result
              </p>
              <div className="bg-azure-bg dark:bg-zinc-950 rounded-lg p-3 text-xs font-mono overflow-auto max-h-64 text-azure-text-primary dark:text-matrix-text border border-azure-border dark:border-matrix-primary/30 whitespace-pre-wrap">
                {detail.result ?? (
                  <span className="text-yellow-600 dark:text-yellow-400 animate-pulse">
                    Processing…
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetail(null)}
                className="px-4 py-2 rounded-lg border border-azure-border dark:border-matrix-primary text-azure-text-secondary dark:text-matrix-dim text-sm hover:bg-azure-surface dark:hover:bg-zinc-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </motion.div>
  );
};
