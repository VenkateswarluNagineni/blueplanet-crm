'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, KeyRound, Ban, RotateCcw, UserCog } from 'lucide-react';
import {
  createUserAction,
  updateUserAction,
  resetPasswordAction,
  deactivateUserAction,
  reactivateUserAction,
} from '@/server/users/actions';
import type { AdminUser } from '@/server/users/queries';
import { USER_ROLES } from '@/lib/domain/reference';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { Drawer } from '@/components/ui/Drawer';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

const ROLE_TONE: Record<string, 'gold' | 'green' | 'blue'> = { ADMIN: 'gold', SALES: 'green', VENDOR: 'blue' };

type LocationOption = { id: string; name: string };

export function UsersClient({ users, locations, currentUserId }: { users: AdminUser[]; locations: LocationOption[]; currentUserId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [drawer, setDrawer] = useState<{ mode: 'ADD' } | { mode: 'EDIT'; user: AdminUser } | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [actionError, setActionError] = useState('');
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);

  const openAdd = () => { setDrawer({ mode: 'ADD' }); setSelectedLocationIds([]); setActionError(''); };
  const openEdit = (u: AdminUser) => {
    setDrawer({ mode: 'EDIT', user: u });
    setSelectedLocationIds(locations.filter((l) => u.locationNames.includes(l.name)).map((l) => l.id));
    setActionError('');
  };
  const close = () => { setDrawer(null); setActionError(''); };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!drawer) return;
    const fd = new FormData(e.currentTarget);
    const role = String(fd.get('role') ?? '');
    setActionError('');
    startTransition(async () => {
      const res = drawer.mode === 'ADD'
        ? await createUserAction({ email: String(fd.get('email') ?? ''), password: String(fd.get('password') ?? ''), role, locationIds: selectedLocationIds })
        : await updateUserAction(drawer.user.id, { role, locationIds: selectedLocationIds });
      if (!res.ok) { setActionError(res.error); return; }
      close();
      toast(drawer.mode === 'ADD' ? 'User created.' : 'User updated.', 'success');
      router.refresh();
    });
  };

  const handleResetPassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!resetTarget) return;
    const fd = new FormData(e.currentTarget);
    setActionError('');
    startTransition(async () => {
      const res = await resetPasswordAction(resetTarget.id, String(fd.get('password') ?? ''));
      if (!res.ok) { setActionError(res.error); return; }
      setResetTarget(null);
      toast(`Password reset for ${resetTarget.email}.`, 'success');
    });
  };

  const handleToggleActive = async (u: AdminUser) => {
    if (u.active) {
      const ok = await confirm({
        title: `Deactivate ${u.email}?`,
        message: 'They will no longer be able to sign in. This can be reversed.',
        confirmLabel: 'Deactivate', tone: 'danger',
      });
      if (!ok) return;
    }
    startTransition(async () => {
      const res = u.active ? await deactivateUserAction(u.id) : await reactivateUserAction(u.id);
      if (!res.ok) { toast(res.error, 'error'); return; }
      toast(u.active ? `${u.email} deactivated.` : `${u.email} reactivated.`, 'success');
      router.refresh();
    });
  };

  const cur = drawer?.mode === 'EDIT' ? drawer.user : null;

  return (
    <PageShell
      header={
        <PageHeader
          breadcrumbs={[{ label: 'Ops', href: '/' }, { label: 'Users' }]}
          title="Users"
          subtitle="Logins, roles, and location access."
          meta={[{ label: `${users.filter((u) => u.active).length} active`, tone: 'green' }, { label: `${users.length} total`, tone: 'neutral' }]}
          actions={
            <Button type="button" onClick={openAdd} size="sm">
              <Plus size={14} /> New User
            </Button>
          }
        />
      }
    >
      {confirmDialog}
      {users.length === 0 ? (
        <EmptyState icon={UserCog} title="No users yet" hint="Add the first login for this workspace." action={<Button onClick={openAdd}><Plus size={14} /> New User</Button>} />
      ) : (
        <div className="bp-table-shell mx-0 overflow-x-auto">
          <table className="bp-table min-w-max">
            <thead>
              <tr>
                <th className="bp-col-pin">Email</th>
                <th>Role</th>
                <th>Locations</th>
                <th>Linked party</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={!u.active ? 'opacity-60' : ''}>
                  <td className="bp-id bp-col-pin">{u.email}</td>
                  <td><Badge tone={ROLE_TONE[u.role] ?? 'neutral'}>{u.role}</Badge></td>
                  <td className="text-[var(--color-text-secondary)]">
                    {u.locationNames.length > 0 ? u.locationNames.join(', ') : <span className="text-[var(--color-fog-500)]">All / none assigned</span>}
                  </td>
                  <td className="text-[var(--color-text-secondary)]">{u.partyName ?? '—'}</td>
                  <td>
                    <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${u.active ? 'bg-[rgba(16,185,129,0.1)] text-[var(--color-emerald)] border-[rgba(16,185,129,0.3)]' : 'bg-[var(--color-basalt-700)] text-[var(--color-fog-400)] border-[var(--color-basalt-500)]'}`}>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="bp-row-actions">
                      <button className="bp-row-action" onClick={() => openEdit(u)} title="Edit role & locations">Edit</button>
                      <button className="bp-row-action" onClick={() => setResetTarget(u)} title="Reset password"><KeyRound size={12} /> Reset</button>
                      <button
                        className={`bp-row-action ${u.active ? '' : 'bp-row-action--primary'}`}
                        onClick={() => handleToggleActive(u)}
                        disabled={u.id === currentUserId}
                        title={u.id === currentUserId ? "Can't deactivate your own active session" : u.active ? 'Deactivate' : 'Reactivate'}
                      >
                        {u.active ? <Ban size={12} /> : <RotateCcw size={12} />} {u.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={!!drawer}
        onClose={close}
        width={480}
        title={drawer?.mode === 'ADD' ? 'New User' : `Edit ${cur?.email ?? 'User'}`}
        footer={
          <>
            <Button variant="ghost" size="sm" type="button" onClick={close}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" form="user-form" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save User'}
            </Button>
          </>
        }
      >
        {drawer && (
          <form id="user-form" onSubmit={handleSubmit} className="p-6 space-y-5 text-[13px]">
            <div className="space-y-1.5">
              <label className="text-[var(--color-text-secondary)] block text-[12px]">Email <span className="text-[var(--color-ruby)]">*</span></label>
              <input name="email" type="email" required disabled={drawer.mode === 'EDIT'} defaultValue={cur?.email} placeholder="name@company.com" className="bp-input disabled:opacity-60" />
            </div>
            {drawer.mode === 'ADD' && (
              <div className="space-y-1.5">
                <label className="text-[var(--color-text-secondary)] block text-[12px]">Password <span className="text-[var(--color-ruby)]">*</span></label>
                <input name="password" type="password" required minLength={8} placeholder="At least 8 characters" className="bp-input" />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[var(--color-text-secondary)] block text-[12px]">Role</label>
              <select name="role" defaultValue={cur?.role ?? 'SALES'} className="bp-select">
                {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[var(--color-text-secondary)] block text-[12px]">Location access</label>
              <div className="border border-[var(--color-basalt-500)] rounded-[var(--radius-sm)] p-2 space-y-1 max-h-40 overflow-y-auto">
                {locations.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 px-1.5 py-1 rounded text-[12px] text-white hover:bg-[var(--color-basalt-700)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLocationIds.includes(l.id)}
                      onChange={() => setSelectedLocationIds((prev) => prev.includes(l.id) ? prev.filter((x) => x !== l.id) : [...prev, l.id])}
                      className="accent-[var(--color-vein)]"
                    />
                    {l.name}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-[var(--color-fog-400)]">No locations selected = unrestricted (matches ADMIN default behavior).</p>
            </div>
            {actionError && (
              <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-[var(--color-ruby)] text-[12px] px-3 py-2 rounded-[var(--radius-sm)]">
                {actionError}
              </div>
            )}
          </form>
        )}
      </Drawer>

      <Modal
        open={!!resetTarget}
        onClose={() => { setResetTarget(null); setActionError(''); }}
        title={`Reset password — ${resetTarget?.email ?? ''}`}
        width={400}
        footer={
          <>
            <Button variant="ghost" size="sm" type="button" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" form="reset-password-form" disabled={isPending}>
              {isPending ? 'Saving…' : 'Reset Password'}
            </Button>
          </>
        }
      >
        {resetTarget && (
          <form id="reset-password-form" onSubmit={handleResetPassword} className="space-y-3 text-[13px]">
            <div className="space-y-1.5">
              <label className="text-[var(--color-text-secondary)] block text-[12px]">New password <span className="text-[var(--color-ruby)]">*</span></label>
              <input name="password" type="password" required minLength={8} placeholder="At least 8 characters" className="bp-input" autoFocus />
            </div>
            {actionError && (
              <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-[var(--color-ruby)] text-[12px] px-3 py-2 rounded-[var(--radius-sm)]">
                {actionError}
              </div>
            )}
          </form>
        )}
      </Modal>
    </PageShell>
  );
}
