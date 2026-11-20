// PROTOTYPE (throwaway): three variants of the Notification Feed, switchable via ?variant=A|B|C
// A = bell + dropdown only
// B = bell + dropdown (latest 5) + "View all" full page at /notifications-prototype
// C = bell + right-hand slide-over panel with All/Unread tabs, grouped by day
// Append ?empty=1 to see the empty state. All data is stubbed in memory; reload resets it.
// Notifications are the seven from the "which Notifications" decision, filtered by role.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  X,
  Receipt,
  MessageSquare,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "~/lib/utils";

type Kind =
  | "refund-approved"
  | "refund-declined"
  | "reply"
  | "lesson-comment"
  | "enrollment"
  | "open-refund"
  | "seat-claimed";

interface Item {
  id: number;
  kind: Kind;
  text: string;
  detail: string;
  ago: string;
  day: "Today" | "Earlier";
  to: string;
  read: boolean;
}

const KIND_ICON: Record<Kind, React.ReactNode> = {
  "refund-approved": <Receipt className="size-4" />,
  "refund-declined": <Receipt className="size-4" />,
  reply: <MessageSquare className="size-4" />,
  "lesson-comment": <MessageSquare className="size-4" />,
  enrollment: <UserPlus className="size-4" />,
  "open-refund": <Receipt className="size-4" />,
  "seat-claimed": <Users className="size-4" />,
};

function seed(role: string | null, isTeamAdmin: boolean): Item[] {
  let id = 1;
  const mk = (
    kind: Kind,
    text: string,
    detail: string,
    ago: string,
    day: Item["day"],
    to: string,
    read = false
  ): Item => ({ id: id++, kind, text, detail, ago, day, to, read });

  const out: Item[] = [];
  if (role === "student") {
    out.push(
      mk("refund-approved", "Your refund was approved", "Intro to TypeScript", "5m", "Today", "/dashboard"),
      mk("reply", "Sam replied to your comment", "Lesson 3: Generics", "2h", "Today", "/courses"),
      mk("refund-declined", "Your refund request was declined", "Advanced React", "2d", "Earlier", "/courses", true)
    );
  }
  if (role === "instructor") {
    out.push(
      mk("enrollment", "Priya enrolled in your course", "Intro to TypeScript", "12m", "Today", "/instructor"),
      mk("lesson-comment", "New question on your lesson", "Lesson 3: Generics", "1h", "Today", "/instructor/questions"),
      mk("enrollment", "Lee enrolled in your course", "Advanced React", "3d", "Earlier", "/instructor", true),
      mk("lesson-comment", "New comment on your lesson", "Lesson 1: Setup", "4d", "Earlier", "/instructor/questions", true)
    );
  }
  if (role === "admin") {
    out.push(
      mk("open-refund", "New refund request to review", "Advanced React · $79", "3m", "Today", "/admin/refunds"),
      mk("open-refund", "New refund request to review", "Intro to TypeScript · $49", "1d", "Earlier", "/admin/refunds", true)
    );
  }
  if (isTeamAdmin) {
    out.unshift(
      mk("seat-claimed", "Jo claimed a seat on your team licence", "Intro to TypeScript", "30m", "Today", "/team")
    );
  }
  // pad so the dropdown overflow / "View all" is visible
  while (out.length > 0 && out.length < 8) {
    out.push(
      mk("reply", "Older notification (padding)", "Some course", `${out.length + 4}d`, "Earlier", "/courses", true)
    );
  }
  return out.map((n, i) => ({ ...n, id: i + 1 }));
}

// ---- tiny in-memory store shared by bell, panel and full page ----
let state: { key: string; items: Item[] } = { key: "", items: [] };
const listeners = new Set<() => void>();
const EMPTY: Item[] = [];
function emit() {
  listeners.forEach((l) => l());
}
function ensure(key: string, role: string | null, isTeamAdmin: boolean) {
  if (state.key !== key) {
    state = { key, items: key.endsWith(":empty") ? [] : seed(role, isTeamAdmin) };
    emit();
  }
}
function useItems(): Item[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state.items,
    () => EMPTY
  );
}
function markRead(id: number) {
  state = { ...state, items: state.items.map((n) => (n.id === id ? { ...n, read: true } : n)) };
  emit();
}
function markAllRead() {
  state = { ...state, items: state.items.map((n) => ({ ...n, read: true })) };
  emit();
}

// ---- hook the layout calls once ----
export function useNotificationPrototype(
  currentUser: { id: number; role: string } | null,
  isTeamAdmin: boolean
) {
  const [params] = useSearchParams();
  const empty = params.get("empty") === "1";
  const key = `${currentUser?.id ?? "none"}:${isTeamAdmin}${empty ? ":empty" : ""}`;
  ensure(key, currentUser?.role ?? null, isTeamAdmin);
  const variant = params.get("variant") ?? "A";
  return { variant: ["A", "B", "C"].includes(variant) ? variant : "A" };
}

function KindDot({ kind, read }: { kind: Kind; read: boolean }) {
  const tone =
    kind === "refund-declined"
      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      : kind === "refund-approved" || kind === "enrollment" || kind === "seat-claimed"
        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", tone, read && "opacity-50")}>
      {KIND_ICON[kind]}
    </span>
  );
}

function Row({ n, onGo, compact = false }: { n: Item; onGo: () => void; compact?: boolean }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => {
        markRead(n.id);
        onGo();
        navigate(n.to);
      }}
      className={cn(
        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
        !n.read && "bg-primary/5"
      )}
    >
      <KindDot kind={n.kind} read={n.read} />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", n.read ? "text-muted-foreground" : "font-semibold")}>{n.text}</span>
        {!compact && <span className="block truncate text-xs text-muted-foreground">{n.detail}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs text-muted-foreground">{n.ago}</span>
        {!n.read && <span className="size-2 rounded-full bg-primary" />}
      </span>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <Bell className="size-8 text-muted-foreground/50" />
      <div className="text-sm font-medium">You're all caught up</div>
      <div className="text-xs text-muted-foreground">
        Refund decisions, replies and enrolments will show up here.
      </div>
    </div>
  );
}

function BellButton({ onClick, unread, active }: { onClick: () => void; unread: number; active: boolean }) {
  return (
    <button
      onClick={onClick}
      title="Notifications"
      aria-label={`Notifications, ${unread} unread`}
      className={cn(
        "relative rounded-md p-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active && "bg-sidebar-accent"
      )}
    >
      <Bell className="size-4" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);
  return ref;
}

// ---- Variant A / B: dropdown ----
function Dropdown({ withViewAll }: { withViewAll: boolean }) {
  const items = useItems();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const unread = items.filter((n) => !n.read).length;
  const shown = withViewAll ? items.slice(0, 5) : items;
  return (
    <div ref={ref} className="relative">
      <BellButton onClick={() => setOpen((o) => !o)} unread={unread} active={open} />
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            <button
              onClick={markAllRead}
              disabled={unread === 0}
              className="flex items-center gap-1 text-xs text-primary disabled:text-muted-foreground"
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <EmptyState />
          ) : (
            <div className={cn("divide-y", !withViewAll && "max-h-96 overflow-y-auto")}>
              {shown.map((n) => (
                <Row key={n.id} n={n} onGo={() => setOpen(false)} />
              ))}
            </div>
          )}
          {withViewAll && items.length > 0 && (
            <Link
              to="/notifications-prototype?variant=B"
              onClick={() => setOpen(false)}
              className="block border-t px-4 py-2.5 text-center text-xs font-medium text-primary hover:bg-accent"
            >
              View all notifications ({items.length})
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Variant C: slide-over ----
function SlideOver() {
  const items = useItems();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const unread = items.filter((n) => !n.read).length;
  const list = tab === "unread" ? items.filter((n) => !n.read) : items;
  return (
    <>
      <BellButton onClick={() => setOpen(true)} unread={unread} active={open} />
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onMouseDown={() => setOpen(false)}>
          <aside
            onMouseDown={(e) => e.stopPropagation()}
            className="flex h-full w-[26rem] flex-col border-l bg-background shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-lg font-bold">Notifications</h2>
              <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-accent">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex items-center justify-between border-b px-5 pb-3">
              <div className="flex gap-1">
                {(["all", "unread"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium capitalize",
                      tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {t}
                    {t === "unread" && unread > 0 ? ` (${unread})` : ""}
                  </button>
                ))}
              </div>
              <button
                onClick={markAllRead}
                disabled={unread === 0}
                className="flex items-center gap-1 text-xs text-primary disabled:text-muted-foreground"
              >
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {list.length === 0 ? (
                tab === "unread" && items.length > 0 ? (
                  <div className="px-6 py-10 text-center text-sm text-muted-foreground">No unread notifications.</div>
                ) : (
                  <EmptyState />
                )
              ) : (
                (["Today", "Earlier"] as const).map((day) => {
                  const group = list.filter((n) => n.day === day);
                  if (group.length === 0) return null;
                  return (
                    <section key={day}>
                      <div className="sticky top-0 bg-muted/80 px-5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                        {day}
                      </div>
                      <div className="divide-y">
                        {group.map((n) => (
                          <Row key={n.id} n={n} onGo={() => setOpen(false)} />
                        ))}
                      </div>
                    </section>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

/** Rendered in the sidebar header in place of nothing. */
export function NotificationBellPrototype({ variant }: { variant: string }) {
  if (variant === "C") return <SlideOver />;
  return <Dropdown withViewAll={variant === "B"} />;
}

/** Full page for variant B. Mounted by the throwaway route. */
export function NotificationsPagePrototype() {
  const items = useItems();
  const unread = items.filter((n) => !n.read).length;
  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <button
          onClick={markAllRead}
          disabled={unread === 0}
          className="flex items-center gap-1 text-sm text-primary disabled:text-muted-foreground"
        >
          <CheckCheck className="size-4" /> Mark all read
        </button>
      </div>
      <div className="overflow-hidden rounded-lg border">
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y">
            {items.map((n) => (
              <Row key={n.id} n={n} onGo={() => {}} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Floating switcher, bottom centre. Dev only. */
export function PrototypeSwitcher({ variant }: { variant: string }) {
  const [params, setParams] = useSearchParams();
  const keys = ["A", "B", "C"];
  const names: Record<string, string> = { A: "Dropdown only", B: "Dropdown + full page", C: "Slide-over panel" };
  const empty = params.get("empty") === "1";
  function go(v: string) {
    const next = new URLSearchParams(params);
    next.set("variant", v);
    setParams(next, { replace: true });
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const i = keys.indexOf(variant);
      if (e.key === "ArrowLeft") go(keys[(i + keys.length - 1) % keys.length]);
      if (e.key === "ArrowRight") go(keys[(i + 1) % keys.length]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (process.env.NODE_ENV === "production") return null;
  const i = keys.indexOf(variant);
  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full bg-zinc-900 px-3 py-2 text-xs text-white shadow-xl">
      <button onClick={() => go(keys[(i + keys.length - 1) % keys.length])}>
        <ChevronLeft className="size-4" />
      </button>
      <span className="font-mono">
        {variant} ({names[variant]})
      </span>
      <button onClick={() => go(keys[(i + 1) % keys.length])}>
        <ChevronRight className="size-4" />
      </button>
      <span className="h-4 w-px bg-white/30" />
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={empty}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            if (e.target.checked) next.set("empty", "1");
            else next.delete("empty");
            setParams(next, { replace: true });
          }}
        />
        empty
      </label>
    </div>
  );
}
