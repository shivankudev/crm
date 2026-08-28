"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, KeyRound, Trash2, Copy, Check, RefreshCw, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { isRoleBelow } from "@/lib/rbac/permissions";

type Role = { id: string; name: string };
type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  active: boolean;
  roleId: string;
  roleName: string;
  teamName: string | null;
  /** Server-computed: whether the viewer is allowed to act on this user at all. */
  canManage: boolean;
};

const inputClass =
  "focus:border-brand-400 focus:ring-brand-100 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2";
const selectClass =
  "rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400";

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function UsersTable({
  initialUsers,
  roles,
  currentUserId,
  canManageAll,
  currentUserRoleName,
}: {
  initialUsers: UserRow[];
  roles: Role[];
  currentUserId: string;
  canManageAll: boolean;
  currentUserRoleName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [users, setUsers] = useState(initialUsers);
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [isPending, startTransition] = useTransition();

  // Mirrors assertCanManageRole() server-side: an Admin can only assign a
  // role strictly junior to their own (never a peer Admin or Super Admin).
  const assignableRoles = canManageAll ? roles : roles.filter((r) => isRoleBelow(currentUserRoleName, r.name));

  async function patchUser(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/v1/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Something went wrong");
      return;
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              roleId: data.user.roleId ?? u.roleId,
              roleName: roles.find((r) => r.id === data.user.roleId)?.name ?? u.roleName,
              active: data.user.active ?? u.active,
            }
          : u
      )
    );
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{users.length} user(s)</p>
        <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>
          Add user
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-slate-100 text-xs font-medium tracking-wide whitespace-nowrap text-slate-400 uppercase">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={u.name} size="sm" />
                    <span className="font-medium text-slate-900">{u.name}</span>
                    {u.id === currentUserId && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">you</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.roleId}
                    disabled={u.id === currentUserId || !u.canManage || isPending}
                    title={!u.canManage ? "Outside your management scope" : undefined}
                    onChange={(e) => patchUser(u.id, { roleId: e.target.value })}
                    className={selectClass}
                  >
                    {(!assignableRoles.some((r) => r.id === u.roleId)
                      ? [{ id: u.roleId, name: u.roleName }, ...assignableRoles]
                      : assignableRoles
                    ).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-slate-600">{u.teamName ?? "—"}</td>
                <td className="px-4 py-3">
                  <button
                    disabled={u.id === currentUserId || !u.canManage || isPending}
                    title={!u.canManage ? "Outside your management scope" : undefined}
                    onClick={() => patchUser(u.id, { active: !u.active })}
                    className={`chip transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      u.active ? "chip-pos hover:brightness-110" : "chip-mute hover:brightness-110"
                    }`}
                  >
                    {u.active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      disabled={!u.canManage}
                      onClick={() => setResetTarget(u)}
                      title={!u.canManage ? "Outside your management scope" : "Reset password"}
                      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <KeyRound size={13} />
                      Reset password
                    </button>
                    <button
                      disabled={u.id === currentUserId || !u.canManage}
                      onClick={() => setDeleteTarget(u)}
                      title={!u.canManage ? "Outside your management scope" : "Delete user"}
                      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-chip-neg transition hover:bg-chip-neg/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showCreate && (
        <CreateUserModal
          roles={assignableRoles}
          onClose={() => setShowCreate(false)}
          onCreated={(user) => {
            setUsers((prev) => [
              ...prev,
              {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: null,
                active: true,
                roleId: user.roleId,
                roleName: roles.find((r) => r.id === user.roleId)?.name ?? "",
                teamName: null,
                canManage: true, // just created it from assignableRoles, always in scope
              },
            ]);
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}

      {resetTarget && <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />}

      {deleteTarget && (
        <DeleteUserModal
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
            toast.success(`${deleteTarget.name} was deleted.`);
            setDeleteTarget(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function CreateUserModal({
  roles,
  onClose,
  onCreated,
}: {
  roles: Role[];
  onClose: () => void;
  onCreated: (user: { id: string; name: string; email: string; roleId: string }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/v1/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, roleId }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    onCreated(data.user);
  }

  return (
    <div className="motion-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
      <div className="motion-pop w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-slate-900">Add user</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            required
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
          <input
            required
            type="password"
            minLength={8}
            placeholder="Temporary password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className={`${inputClass} bg-white`}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name.replaceAll("_", " ")}
              </option>
            ))}
          </select>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? "Creating…" : "Create user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/v1/users/${user.id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: password }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setDone(true);
  }

  function copy() {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="motion-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
      <div className="motion-pop w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="bg-brand-50 text-brand-600 flex h-9 w-9 items-center justify-center rounded-lg">
            <KeyRound size={17} strokeWidth={2.25} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Reset password</h2>
            <p className="text-xs text-slate-500">{user.name}</p>
          </div>
        </div>

        {done ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-lg border border-chip-pos/25 bg-chip-pos/5 px-3 py-2.5 text-sm text-chip-pos">
              Password reset. Share the new password with {user.name} securely — they&apos;ll be signed out of
              every device and need to log in again.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <code className="flex-1 truncate text-sm text-slate-800">{password}</code>
              <button
                type="button"
                onClick={copy}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={onClose}
                className="rounded bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div className="relative">
              <input
                required
                minLength={8}
                type={reveal ? "text" : "password"}
                placeholder="New password (min 8 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-9`}
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                {reveal ? "Hide" : "Show"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPassword(generatePassword())}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              <RefreshCw size={12} />
              Generate a strong password
            </button>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || password.length < 8}
                className="rounded bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
              >
                {submitting ? "Resetting…" : "Reset password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function DeleteUserModal({
  user,
  onClose,
  onDeleted,
}: {
  user: UserRow;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function confirmDelete() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/v1/users/${user.id}`, { method: "DELETE" });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    onDeleted();
  }

  return (
    <div className="motion-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
      <div className="motion-pop w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chip-neg/10 text-chip-neg">
            <AlertTriangle size={17} strokeWidth={2.25} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Delete {user.name}?</h2>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600">
          This permanently removes their login. It only works for an account with no leads, calls, or other
          activity on record — if they&apos;ve done anything in the system, deactivate them instead of deleting.
        </p>

        {error && (
          <p className="mt-3 rounded-lg border border-chip-neg/25 bg-chip-neg/5 px-3 py-2 text-sm text-chip-neg">{error}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={confirmDelete}
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-lg bg-chip-neg px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
          >
            <Trash2 size={13} />
            {submitting ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
