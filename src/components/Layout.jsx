import { useEffect, useId, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Inbox, BookOpen, BarChart3, FileText, Settings, Search, CheckCircle2, AlertTriangle, Bell, Gauge, ClipboardCheck,
  User, Phone, MessageSquare, Target, X, ChevronLeft, ChevronRight, Menu, RotateCcw, LogOut, Sun, Moon, Monitor, Check,
} from 'lucide-react';
import { useApp, useAccount, ME } from '../state/AppContext';
import { useTheme } from '../state/theme';
import { AGENTS, agentById } from '../data/agents';
import { Avatar, InitialTile, Modal, cx, useDismiss } from './ui';
import { agentPath } from '../utils/roster';

const NAV = {
  supervisor: {
    sections: [
      { label: 'Team', items: [
        { to: '/home', label: 'Home', icon: Home },
        { to: '/queue', label: 'Review Queue', icon: Inbox, badge: 'queue' },
        { to: '/performance', label: 'Agent Performance', icon: Gauge },
        { to: '/grading', label: 'Call Grading', icon: ClipboardCheck },
        { to: '/coaching', label: 'Coaching', icon: MessageSquare },
        { to: '/goals', label: 'Goals & Progress', icon: Target },
        { to: '/library', label: 'Call Library', icon: BookOpen },
        { to: '/analytics', label: 'Team Analytics', icon: BarChart3 },
        { to: '/reports', label: 'Reports', icon: FileText },
      ] },
      { label: 'Configure', items: [{ to: '/settings', label: 'QA Template Settings', icon: Settings }] },
    ],
  },
  agent: {
    sections: [
      { label: 'My workspace', items: [
        { to: '/me', label: 'My Performance', icon: User, end: true },
        { to: '/me/calls', label: 'My Calls', icon: Phone },
        { to: '/me/coaching', label: 'My Coaching', icon: MessageSquare, badge: 'ack' },
        { to: '/me/goals', label: 'My Goals', icon: Target },
      ] },
    ],
  },
};
// Agent-scoped supervisor pages: searching for an agent from one of these stays on it
const AGENT_PAGES = ['/performance', '/grading', '/coaching', '/goals'];
const COLLAPSE_KEY = 'coaching360-sidebar-collapsed';

const BRAND = `${import.meta.env.BASE_URL}brand/`;

// The PowerConnect head icon, for light or dark backgrounds
export function LogoMark({ size = 16, alt = '' }) {
  return <img src={`${BRAND}powerconnect-icon.png`} width={size} height={size} alt={alt} className="shrink-0" />;
}

// The full PowerConnect logo; its wordmark is white, so only use it on dark backgrounds
export function BrandLogo({ height = 20, className = '' }) {
  return <img src={`${BRAND}powerconnect-logo-on-dark.png`} height={height} style={{ height }} alt="PowerConnect.ai" className={cx('w-auto shrink-0', className)} />;
}

// 48px nav item; the active one gets the black fade and a 3px white bar on its left edge
const sideLink = (collapsed) => ({ isActive }) => cx(
  'group relative flex h-12 shrink-0 items-center gap-5 rounded-control px-3.5 text-[13px] no-underline transition-colors',
  collapsed && 'justify-center gap-0 px-0',
  isActive
    ? 'font-medium text-white [background:var(--sidebar-active)] before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-white'
    : 'text-sidebar-fg hover:bg-sidebar-hover hover:text-white',
);

function Sidebar({ onClose, collapsed = false, onToggle }) {
  const { state, queue } = useApp();
  const nav = NAV[state.role];
  const badges = {
    queue: queue.length,
    ack: state.sessions.filter((s) => s.agentId === ME && s.status === 'Delivered').length,
  };
  return (
    <div className="scope-dark relative flex h-full flex-col gap-7 bg-sidebar px-3 py-8 text-sidebar-fg shadow-[10px_0_30px_rgba(0,0,0,0.2),inset_-2px_0_10px_rgba(255,255,255,0.02)]">
      {onClose && <button className="icon-btn absolute top-3 right-3 text-sidebar-fg hover:bg-sidebar-hover" onClick={onClose} aria-label="Close navigation"><X size={18} /></button>}
      {/* PowerConnect.AI logo (white wordmark, made for dark backgrounds); just the head icon when collapsed */}
      <div className="flex h-12 shrink-0 items-center justify-center">
        {collapsed ? <LogoMark size={38} alt="PowerConnect.ai" /> : <BrandLogo height={32} className="max-w-full" />}
      </div>
      {onToggle && (
        <button
          className="absolute top-[44px] -right-3 z-10 grid size-6 place-items-center rounded-full bg-white text-[#0F2853] shadow-pop hover:bg-white/90"
          onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronLeft size={14} aria-hidden="true" />}
        </button>
      )}
      <nav aria-label="Main" className="-mx-1 flex min-h-0 flex-col gap-1 overflow-y-auto px-1">
        {nav.sections.map((sec, si) => (
          <div key={sec.label} className={cx('flex flex-col gap-1', si > 0 && 'mt-4')}>
            {collapsed ? <span className="mx-auto mb-1 h-px w-6 bg-sidebar-border" aria-hidden="true" /> : <span className="label-caps mb-1 px-3.5">{sec.label}</span>}
            {sec.items.map((i) => {
              const Icon = i.icon;
              const n = i.badge && badges[i.badge];
              return (
                <NavLink key={i.to} to={i.to} end={i.end} className={sideLink(collapsed)} title={collapsed ? i.label : undefined} aria-label={collapsed ? i.label : undefined}>
                  <Icon size={18} className="shrink-0 text-white" aria-hidden="true" />
                  {!collapsed && <span className="truncate">{i.label}</span>}
                  {n > 0 && (
                    <span className={cx('rounded-full bg-white px-1.5 font-heading text-[11px] leading-[18px] font-bold text-[#0F2853] tabular-nums', collapsed ? 'absolute top-1.5 right-1.5' : 'ml-auto')} aria-label={`${n} pending`}>{n}</span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}

function MobileDrawer({ open, onClose }) {
  const ref = useRef();
  useEffect(() => {
    if (!open) return undefined;
    ref.current?.querySelector('a, button')?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 animate-fade bg-overlay" onClick={onClose} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Navigation" className="absolute inset-y-0 left-0 w-[min(230px,85vw)] animate-slide-in">
        <Sidebar onClose={onClose} />
      </div>
    </div>
  );
}

function AgentSearch({ autoFocus, onDone }) {
  const { dispatch, notify } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const listId = useId();
  const hits = AGENTS.filter((a) => `${a.name} ${a.team} ${a.lead}`.toLowerCase().includes(q.toLowerCase())).slice(0, 7);
  const pick = (a) => {
    dispatch({ type: 'agent', agentId: a.id });
    setQ(''); setOpen(false);
    notify(`Now viewing ${a.name}`);
    // Stay in Call Grading when searching from there; everywhere else outside the top tabs opens Agent Performance
    if (pathname.startsWith('/grading')) navigate(agentPath(a.id, '', '/grading'));
    else if (pathname.startsWith('/performance') || !AGENT_PAGES.includes(pathname)) navigate(agentPath(a.id));
    onDone?.();
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(hits.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' && open && hits[active]) { e.preventDefault(); pick(hits[active]); }
    else if (e.key === 'Escape') { setOpen(false); onDone?.(); }
  };
  return (
    <div className="relative w-full">
      <input
        className="h-11 rounded-full border-transparent bg-surface pr-12 pl-5 text-[13px] shadow-card hover:bg-surface focus:border-[var(--focus)]" placeholder="Search agents by name, team or lead…" value={q} autoFocus={autoFocus}
        role="combobox" aria-label="Search agent" aria-autocomplete="list" aria-expanded={open} aria-controls={listId}
        aria-activedescendant={open && hits[active] ? `${listId}-${hits[active].id}` : undefined}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }} onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
      />
      <span className="pointer-events-none absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-inverse text-inverse-fg" aria-hidden="true"><Search size={15} /></span>
      {open && (
        <ul id={listId} role="listbox" aria-label="Agents" className="absolute top-13 right-0 left-0 z-40 animate-pop rounded-card border border-border bg-surface p-1.5 shadow-pop">
          {hits.length === 0 && <li className="px-3 py-2 text-ui text-fg-subtle">No agents found</li>}
          {hits.map((a, i) => (
            <li
              key={a.id} id={`${listId}-${a.id}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(a); }} onMouseEnter={() => setActive(i)}
              className={cx('flex cursor-pointer items-center gap-2.5 rounded-control px-2 py-1.5', i === active && 'bg-surface-hover')}
            >
              <Avatar name={a.name} size={26} />
              <span className="min-w-0"><span className="block truncate text-ui font-medium">{a.name}</span><small className="block">{a.team}</small></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AlertBell() {
  const { state } = useApp();
  const [open, setOpen] = useState(false);
  const root = useRef();
  const trigger = useRef();
  const navigate = useNavigate();
  const panelId = useId();
  useDismiss(open, setOpen, root, trigger);
  const items = state.alerts.filter((a) => a.status === 'Open');
  const go = () => { setOpen(false); navigate('/reports?r=alerts'); };
  return (
    <div className="relative" ref={root}>
      <button
        ref={trigger} className="round-btn relative" aria-label={`${items.length} open alerts`} aria-expanded={open} aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <Bell size={18} aria-hidden="true" />
        {items.length > 0 && <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 font-heading text-[10px] font-bold text-white ring-2 ring-surface" aria-hidden="true">{items.length}</span>}
      </button>
      {open && (
        <div id={panelId} className="absolute top-13 right-0 z-40 flex w-[min(20rem,calc(100vw-2rem))] animate-pop flex-col gap-1 rounded-card border border-border bg-surface p-2 shadow-pop">
          <p className="px-2 pt-1 pb-1.5 font-heading text-base font-bold">Open policy alerts</p>
          {items.length === 0 && <p className="px-2 pb-2 text-ui text-fg-subtle">No open alerts.</p>}
          {items.map((a) => (
            <button key={a.id} onClick={go} className="flex items-start gap-2.5 rounded-control px-2 py-2 text-left hover:bg-surface-hover">
              <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', a.severity === 'High' ? 'bg-danger' : a.severity === 'Medium' ? 'bg-warning' : 'bg-fg-subtle')} aria-hidden="true" />
              <span className="min-w-0"><b className="block text-ui">{a.type}</b><small className="block">{a.severity} · {agentById(a.agentId).name} · {a.date}</small></span>
            </button>
          ))}
          <button className="link-btn mx-2 my-1.5" onClick={go}>View all alerts <ChevronRight size={13} aria-hidden="true" /></button>
        </div>
      )}
    </div>
  );
}

const THEMES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

function ThemeMenu() {
  const { preference, theme, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const root = useRef();
  const trigger = useRef();
  const menuId = useId();
  useDismiss(open, setOpen, root, trigger);
  useEffect(() => {
    if (open) root.current.querySelector('[aria-checked="true"]')?.focus();
  }, [open]);
  const onKeyDown = (e) => {
    const items = [...root.current.querySelectorAll('[role="menuitemradio"]')];
    const i = items.indexOf(document.activeElement);
    const next = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
    if (next == null) return;
    e.preventDefault();
    items[(next + items.length) % items.length].focus();
  };
  const Icon = theme === 'dark' ? Moon : Sun;
  return (
    <div className="relative" ref={root}>
      <button
        ref={trigger} className="round-btn" aria-label={`Theme: ${THEMES.find((t) => t.id === preference).label}`} title="Theme"
        aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)}
      >
        <Icon size={18} aria-hidden="true" />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label="Theme" onKeyDown={onKeyDown} className="absolute top-13 right-0 z-40 w-44 animate-pop rounded-card border border-border bg-surface p-1.5 shadow-pop">
          {THEMES.map((t) => (
            <button
              key={t.id} role="menuitemradio" aria-checked={preference === t.id}
              onClick={() => { setPreference(t.id); setOpen(false); trigger.current.focus(); }}
              className="flex h-10 w-full items-center gap-2.5 rounded-control px-2.5 text-[13px] text-fg hover:bg-surface-hover focus-visible:bg-surface-hover"
            >
              <t.icon size={16} className="text-fg-muted" aria-hidden="true" />{t.label}
              {preference === t.id && <Check size={15} className="ml-auto text-link" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileMenu() {
  const { state, dispatch, notify } = useApp();
  const account = useAccount();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const root = useRef();
  const trigger = useRef();
  const menuId = useId();
  useDismiss(open, setOpen, root, trigger);
  useEffect(() => {
    if (open) root.current.querySelector('[role="menuitem"]')?.focus();
  }, [open]);
  const onKeyDown = (e) => {
    const items = [...root.current.querySelectorAll('[role="menuitem"]')];
    const i = items.indexOf(document.activeElement);
    const next = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
    if (next == null) return;
    e.preventDefault();
    items[(next + items.length) % items.length].focus();
  };
  const signOut = () => { setOpen(false); dispatch({ type: 'logout' }); navigate('/login', { replace: true }); };
  const subtitle = state.role === 'agent' ? `${agentById(ME).team} · Agent` : 'Supervisor';
  const item = 'flex h-10 w-full items-center gap-2.5 rounded-control px-2 text-[13px] text-fg hover:bg-surface-hover focus-visible:bg-surface-hover';
  return (
    <div className="relative" ref={root}>
      <button
        ref={trigger} className="rounded-full ring-2 ring-transparent transition-shadow hover:ring-[var(--focus-ring)]"
        aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)}
      >
        <span className="sr-only">Profile: {account.name}</span>
        <Avatar name={account.name} size={44} />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label="Profile" onKeyDown={onKeyDown} className="absolute top-13 right-0 z-40 w-72 animate-pop rounded-card border border-border bg-surface p-2 shadow-pop">
          <div className="flex items-center gap-3 border-b border-border px-2 pt-2 pb-3.5">
            <InitialTile name={account.name} letters={1} />
            <span className="min-w-0 leading-tight"><b className="block truncate font-heading text-base font-bold tracking-[-0.3px]">{account.name}</b><small className="block truncate">{account.email}</small><small className="block">{subtitle}</small></span>
          </div>
          <div className="pt-2">
            <span className="label-caps block px-2 pt-1 pb-1">Settings</span>
            <button role="menuitem" className={item} onClick={() => { setOpen(false); setConfirm(true); }}><RotateCcw size={16} aria-hidden="true" /> Reset demo data</button>
            <button role="menuitem" className={item} onClick={signOut}><LogOut size={16} aria-hidden="true" /> Sign out</button>
          </div>
        </div>
      )}
      {confirm && (
        <Modal
          title="Reset demo data?" onClose={() => setConfirm(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setConfirm(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => { dispatch({ type: 'reset' }); notify('Demo data reset'); setConfirm(false); }}>Reset</button>
          </>}
        >
          <p className="text-ui">Grades, coaching sessions, goals, disputes and template changes saved in this browser will be lost, and the original demo data restored. You stay signed in.</p>
        </Modal>
      )}
    </div>
  );
}

function Toast() {
  const { toast } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex justify-center px-4" role="status" aria-live="polite">
      {toast && (
        <div
          key={toast.id}
          className={cx(
            'flex max-w-full animate-pop items-center gap-2 rounded-control px-4 py-3 text-sm font-semibold shadow-pop',
            toast.kind === 'warn' ? 'bg-danger text-white' : 'bg-inverse text-inverse-fg',
          )}
        >
          {toast.kind === 'warn' ? <AlertTriangle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} className="text-success" aria-hidden="true" />} {toast.message}
        </div>
      )}
    </div>
  );
}

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
}

export default function Layout() {
  const { state } = useApp();
  const { pathname, search } = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [searching, setSearching] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const menuBtn = useRef();

  useEffect(() => { setDrawer(false); setSearching(false); }, [pathname, search]);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  const closeDrawer = () => { setDrawer(false); menuBtn.current?.focus(); };
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* storage unavailable */ }
      return !c;
    });
  };

  return (
    <div className={cx('min-h-dvh transition-[padding]', collapsed ? 'lg:pl-sidebar-collapsed' : 'lg:pl-sidebar')}>
      <a href="#main" className="sr-only z-[80] rounded-control bg-surface px-3 py-2 text-sm font-medium shadow-pop focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Skip to content</a>
      <aside className={cx('fixed inset-y-0 left-0 z-40 hidden transition-[width] lg:block', collapsed ? 'w-sidebar-collapsed' : 'w-sidebar')}>
        <Sidebar collapsed={collapsed} onToggle={toggle} />
      </aside>
      <MobileDrawer open={drawer} onClose={closeDrawer} />

      <div className="flex min-h-dvh min-w-0 flex-col">
        {/* Sticky top bar with no fill of its own; it sits on the page gradient */}
        <header className="sticky top-0 z-30 backdrop-blur-md">
          <div className="flex h-[76px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button ref={menuBtn} className="round-btn lg:hidden" aria-label="Open navigation" aria-expanded={drawer} onClick={() => setDrawer(true)}>
              <Menu size={20} />
            </button>
            <div className="min-w-0 leading-tight">
              <b className="block font-heading text-xl font-bold tracking-[-0.3px] text-fg">Coaching360</b>
              <small className="hidden text-[11px] font-medium tracking-[0.12em] text-fg-muted uppercase sm:block">Listen. Grade. Coach. Grow.</small>
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              {state.role === 'supervisor' && (
                <>
                  <div className="hidden w-72 md:block xl:w-[26rem]"><AgentSearch /></div>
                  <button className="round-btn md:hidden" aria-label="Search agent" aria-expanded={searching} onClick={() => setSearching(!searching)}><Search size={18} /></button>
                  <AlertBell />
                </>
              )}
              <ThemeMenu />
              <ProfileMenu />
            </div>
          </div>
          {searching && state.role === 'supervisor' && (
            <div className="px-4 pb-3 md:hidden"><AgentSearch autoFocus onDone={() => setSearching(false)} /></div>
          )}
        </header>
        <main id="main" tabIndex={-1} className="flex-1 px-4 pt-2 pb-8 outline-none sm:px-6 lg:px-8"><Outlet /></main>
      </div>
      <Toast />
    </div>
  );
}

export function AgentStrip({ agentId, right, heading: H = 'h1' }) {
  const a = agentById(agentId);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <InitialTile name={a.name} />
      <div className="min-w-0">
        <H className="text-[28px] leading-9 font-bold tracking-[-0.3px]">{a.name}</H>
        <p className="text-[13px] text-fg-muted">{a.team} · Lead: {a.lead} · {a.tenure}</p>
      </div>
      <div className="ml-auto">{right}</div>
    </div>
  );
}
