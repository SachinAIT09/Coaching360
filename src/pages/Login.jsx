import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff, Zap, MessageCircle, Lock, Sparkles, ArrowUp, AlertCircle } from 'lucide-react';
import { useApp, HOME } from '../state/AppContext';
import { checkLogin } from '../state/accounts';
import { cx } from '../components/ui';
import { version } from '../../package.json';

const ICON = `${import.meta.env.BASE_URL}brand/powerconnect-icon.png`;

const FEATURES = [
  { icon: Zap, title: 'Real-time AI Insights', tile: 'from-[#ffb03a] to-[#ff7a1a]' },
  { icon: MessageCircle, title: 'Omnichannel Engagement', tile: 'from-[#4aa8ff] to-[#2563eb]' },
  { icon: Lock, title: 'Enterprise Security', tile: 'from-[#a78bfa] to-[#7c3aed]' },
];

// Frosted glass over the artwork; the login page is light, unlike the rest of the app
const glass = 'border border-white/50 bg-white/30 shadow-[0_8px_32px_rgba(15,40,83,0.18)] backdrop-blur-xl';
const field = 'h-11 rounded-[10px] border-white bg-white px-4 text-[13px] text-[#0f1d3d] placeholder:text-slate-400 hover:bg-white focus:border-[#2f6bff] focus:ring-[#2f6bff]/25';

function Wordmark({ size = 30, className = '' }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <img src={ICON} alt="" style={{ height: size, width: size }} />
      <span className="bg-gradient-to-r from-[#1d4ed8] to-[#2f6bff] bg-clip-text font-heading font-bold tracking-[-0.5px] text-transparent" style={{ fontSize: size * 0.95 }}>
        POWERCONNECT.AI
      </span>
    </span>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect width="7.5" height="7.5" fill="#f25022" /><rect x="8.5" width="7.5" height="7.5" fill="#7fba00" />
      <rect y="8.5" width="7.5" height="7.5" fill="#00a4ef" /><rect x="8.5" y="8.5" width="7.5" height="7.5" fill="#ffb900" />
    </svg>
  );
}

export default function Login() {
  const { state, dispatch, notify } = useApp();
  const navigate = useNavigate();
  const { state: nav } = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState(null); // { kind: 'error' | 'info', text }
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState(null);

  if (state.user) return <Navigate to={HOME[state.role]} replace />;

  const submit = (e) => {
    e.preventDefault();
    const acc = checkLogin(email, password);
    if (!acc) { setMessage({ kind: 'error', text: 'Incorrect email or password.' }); return; }
    dispatch({ type: 'login', email: acc.email });
    notify('Signed in');
    navigate(nav?.from || HOME[acc.role], { replace: true });
  };

  const ask = (e) => {
    e.preventDefault();
    if (question.trim()) setReply('Sign in to ask the assistant about your calls, scores and coaching.');
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#0a1430] font-body">
      {/* Brand artwork with a light shade on the left so the white headline stays readable */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <img src={`${import.meta.env.BASE_URL}brand/login-bg.webp`} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a1430]/45 via-transparent to-transparent" />
      </div>

      <main className="relative mx-auto flex min-h-dvh max-w-[1680px] items-center justify-center gap-12 px-4 py-10 sm:px-8 lg:justify-between lg:px-[6%]">
        <section className="hidden max-w-[640px] flex-1 lg:block">
          <p className="font-body text-5xl leading-[1.15] font-bold tracking-[-1.5px] text-white xl:text-[56px]">
            Intelligent <span className="bg-gradient-to-r from-[#bcd3ff] to-[#8fb0ff] bg-clip-text text-transparent">Customer</span>
            <br />
            Engagement <span className="bg-gradient-to-r from-[#c7d6ff] via-[#a9b8ff] to-[#d6dcff]/70 bg-clip-text text-transparent">Platform</span>
          </p>
          <p className="mt-6 max-w-[480px] text-base leading-relaxed text-white/85">
            AI-powered conversations. Real-time insights. Seamless utility customer experience.
          </p>

          <ul className="mt-7 grid grid-cols-3 gap-3.5">
            {FEATURES.map((f) => (
              <li key={f.title} className={cx(glass, 'rounded-[14px] p-4')}>
                <span className={cx('grid size-8 place-items-center rounded-[9px] bg-gradient-to-br shadow-[0_4px_10px_rgba(0,0,0,0.18)]', f.tile)}>
                  <f.icon size={16} className="fill-white text-white" aria-hidden="true" />
                </span>
                <b className="mt-4 block text-[13px] font-medium text-[#0f1d3d]">{f.title}</b>
              </li>
            ))}
          </ul>

          <form onSubmit={ask} className={cx(glass, 'mt-6 rounded-[16px] px-5 pt-4 pb-4')}>
            <p className="flex items-center gap-2 text-[11px] font-medium text-[#0f1d3d]">
              <Sparkles size={10} className="fill-[#4f6bff] text-[#4f6bff]" aria-hidden="true" />
              PowerConnect AI Assistant
              <span className="rounded-[5px] bg-[#2563eb] px-1.5 py-0.5 text-[10px] font-bold text-white">BETA</span>
            </p>
            <p className="mt-3 text-[15px] text-[#1e2a4a]">How can I help you today?</p>
            <p role="status" className="mt-2 min-h-10 text-[13px] text-[#1e2a4a]">{reply}</p>
            <div className="flex items-center gap-2 rounded-[10px] border border-white/50 bg-white/25 p-1 pl-3.5">
              <input
                aria-label="Ask the assistant" value={question} placeholder="Ask anything about your energy account..."
                onChange={(e) => { setQuestion(e.target.value); setReply(null); }}
                className="h-8 border-0 bg-transparent px-0 text-[12px] text-[#0f1d3d] placeholder:text-[#3b4a6b] hover:bg-transparent focus:ring-0"
              />
              <button type="submit" className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[8px] bg-[#4b55e0] px-3 text-[12px] font-medium text-white transition-colors hover:bg-[#3f48cc]">
                <ArrowUp size={12} aria-hidden="true" /> Send
              </button>
            </div>
          </form>
        </section>

        <section
          aria-labelledby="login-title"
          className="w-full max-w-[400px] rounded-[22px] border border-white/60 bg-gradient-to-b from-white/70 to-white/45 p-7 text-[#0f1d3d] shadow-[0_20px_60px_rgba(15,40,83,0.28)] backdrop-blur-2xl [&_:focus-visible]:outline-[#2f6bff] sm:p-8"
        >
          <div className="flex flex-col items-center gap-6 text-center">
            <Wordmark size={34} />
            <h1 id="login-title" className="text-[17px] font-medium text-[#0f1d3d]">Sign in with your account</h1>
          </div>

          <form className="mt-6 flex flex-col gap-3.5" onSubmit={submit} noValidate>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.5px] text-[#334155]">EMAIL</span>
              <input
                type="email" className={field} value={email} autoComplete="username" autoFocus required placeholder="name@company.com"
                onChange={(e) => { setEmail(e.target.value); setMessage(null); }}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.5px] text-[#334155]">PASSWORD</span>
              <span className="relative">
                <input
                  type={show ? 'text' : 'password'} className={cx(field, 'pr-11')} value={password} autoComplete="current-password" required
                  onChange={(e) => { setPassword(e.target.value); setMessage(null); }}
                />
                <button
                  type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
                  className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-[#475569] transition-colors hover:bg-slate-100 hover:text-[#0f1d3d]"
                >
                  {show ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
                </button>
              </span>
            </label>
            <button
              type="button" className="self-end rounded text-[13px] font-medium text-[#1e293b] hover:text-[#2f6bff]"
              onClick={() => setMessage({ kind: 'info', text: 'Ask your administrator to reset your password.' })}
            >
              Forgot password?
            </button>

            {message && (
              <p role={message.kind === 'error' ? 'alert' : 'status'} className={cx('flex items-start gap-1.5 text-[13px]', message.kind === 'error' ? 'text-[#b91c1c]' : 'text-[#334155]')}>
                <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{message.text}
              </p>
            )}

            <button
              type="submit"
              className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-[#2563eb] to-[#4f7dff] text-sm font-bold text-white shadow-[0_6px_16px_rgba(37,99,235,0.35)] transition-[filter,transform] hover:-translate-y-px hover:brightness-110 active:translate-y-0"
            >
              <LogIn size={17} aria-hidden="true" /> Sign in
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-[11px] font-semibold tracking-[1px] text-[#334155]">
            <span className="h-px flex-1 bg-[#334155]/25" />OR CONTINUE WITH<span className="h-px flex-1 bg-[#334155]/25" />
          </div>
          <button
            type="button" onClick={() => setMessage({ kind: 'info', text: 'Microsoft sign-in is not set up in this demo. Use your email and password.' })}
            className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-[10px] border border-white/80 bg-white/40 text-[15px] font-medium text-[#0f1d3d] transition-colors hover:bg-white/70"
          >
            <MicrosoftLogo /> Sign in with Microsoft
          </button>

          <div className="mt-6 flex justify-center border-t border-[#334155]/20 pt-6">
            <Wordmark size={20} />
          </div>
        </section>
      </main>

      <small className="absolute right-3 bottom-2 text-[10px] text-white/60">v{version}</small>
    </div>
  );
}
