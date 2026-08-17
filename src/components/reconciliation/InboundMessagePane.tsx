import { Mail } from 'lucide-react';

export type InboundMessageDetail = {
  fromAddress: string;
  subject: string | null;
  createdAt: string;
  bodyText: string;
  bodyHtml: string | null;
};

/**
 * Left pane of the case workspace — the raw email, read-only. Renders bodyText
 * only (no dangerouslySetInnerHTML): this project has no HTML sanitizer
 * dependency yet, and rendering untrusted supplier-email HTML unsanitized is a
 * real XSS surface, not a hypothetical one — plain text is the safe default
 * until a sanitizer is deliberately added.
 */
export function InboundMessagePane({ message }: { message: InboundMessageDetail }) {
  return (
    <div className="bp-card p-4 h-full flex flex-col min-h-0">
      <div className="flex items-center gap-2 text-[var(--color-fog-500)] mb-3">
        <Mail size={14} />
        <p className="text-[10px] uppercase tracking-wider">Supplier email</p>
      </div>
      <div className="mb-3">
        <p className="text-[13px] text-white font-medium">{message.subject ?? '(no subject)'}</p>
        <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
          From <span className="bp-mono">{message.fromAddress}</span> ·{' '}
          {new Date(message.createdAt).toLocaleString()}
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto text-[13px] text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap border-t border-[var(--color-basalt-500)] pt-3">
        {message.bodyText}
      </div>
      {message.bodyHtml && (
        <p className="text-[10px] text-[var(--color-fog-500)] mt-2 pt-2 border-t border-[var(--color-basalt-500)]">
          This message also has an HTML version, not shown — rendered as plain text for safety.
        </p>
      )}
    </div>
  );
}
