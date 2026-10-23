// アバター、スケルトン、ログイン、トースト
import type { User } from '../lib/types';
import { GoogleG } from './icons';
import { startLogin } from '../lib/auth';

export function Avatar({ user, onClick }: { user: User | null; onClick(): void }) {
  if (!user) return null;
  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase();
  return (
    <button type="button" className="avatar glass" aria-label="アカウント" data-testid="avatar" onClick={onClick}>
      {user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : <span style={{ position: 'relative', zIndex: 3 }}>{initial}</span>}
    </button>
  );
}

const WIDTHS = [72, 54, 84, 46, 66, 58];
export function ListSkeleton() {
  return (
    <div data-testid="skeleton" aria-busy="true" aria-label="読み込み中">
      {WIDTHS.map((w, i) => (
        <div key={i} className="sk-row glass">
          <i className="sk sk-dot" />
          <div className="sk-lines">
            <i className="sk sk-line" style={{ width: `${w}%` }} />
            <i className="sk sk-line" style={{ width: `${20 + ((i * 7) % 12)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoginCard() {
  return (
    <section className="login glass" data-testid="login">
      <img className="login-mark" src="/icons/icon.svg" alt="" />
      <button type="button" className="btn-google" data-testid="google-login" onClick={startLogin}>
        <GoogleG />
        Googleでログイン
      </button>
    </section>
  );
}

export interface ToastData {
  id: number;
  text: string;
  out?: boolean;
}

export function Toast({ toast }: { toast: ToastData | null }) {
  if (!toast) return null;
  return (
    <div key={toast.id} className={`toast glass${toast.out ? ' out' : ''}`} role="status" data-testid="toast">
      <span>{toast.text}</span>
    </div>
  );
}
