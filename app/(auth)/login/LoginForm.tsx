'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ui } from '@/lib/strings.et';
import { authErrorMessage, MIN_PASSWORD_LENGTH } from './authErrors';
import styles from './page.module.css';

const t = ui.auth;

// The browser's own validation messages follow the browser language (often English), so set ours.
function setEstonianValidity(input: HTMLInputElement) {
  const v = input.validity;
  if (v.valueMissing) input.setCustomValidity(input.type === 'email' ? t.emailRequired : t.passwordRequired);
  else if (v.typeMismatch) input.setCustomValidity(t.emailInvalid);
  else if (v.tooShort) input.setCustomValidity(t.passwordTooShort(MIN_PASSWORD_LENGTH));
}

const fieldProps = {
  onInvalid: (e: FormEvent<HTMLInputElement>) => setEstonianValidity(e.currentTarget),
  onInput: (e: FormEvent<HTMLInputElement>) => e.currentTarget.setCustomValidity(''),
};

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isSignup = mode === 'signup';

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const credentials = { email: String(form.get('email')), password: String(form.get('password')) };
    setPending(true);
    setError('');
    setNotice('');

    const supabase = createClient();
    const { data, error } = isSignup
      ? await supabase.auth.signUp(credentials)
      : await supabase.auth.signInWithPassword(credentials);

    if (error) {
      setError(authErrorMessage(error));
      setPending(false);
    } else if (!data.session) {
      // Sign-up with email confirmation on: there's no session until the user clicks the link.
      setNotice(t.checkEmail);
      setPending(false);
    } else {
      router.replace('/projects');
      router.refresh();
    }
  }

  function switchMode() {
    setMode(isSignup ? 'login' : 'signup');
    setError('');
    setNotice('');
  }

  return (
    <section className={styles.card}>
      <h1 className={styles.title}>{isSignup ? t.signup : t.login}</h1>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="email">{t.email}</label>
          <input
            {...fieldProps}
            className={styles.input}
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            spellCheck={false}
            enterKeyHint="next"
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="password">{t.password}</label>
          {isSignup && (
            <span id="password-hint" className={styles.hint}>
              {t.passwordHint(MIN_PASSWORD_LENGTH)}
            </span>
          )}
          <div className={styles.passwordRow}>
            <input
              {...fieldProps}
              className={styles.input}
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength={isSignup ? MIN_PASSWORD_LENGTH : undefined}
              aria-describedby={isSignup ? 'password-hint' : undefined}
              enterKeyHint="done"
              required
            />
            <button
              type="button"
              className={styles.secondary}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((s) => !s)}
            >
              {showPassword ? t.hidePassword : t.showPassword}
            </button>
          </div>
        </div>

        {/* Always rendered: a live region that only appears isn't announced reliably. */}
        <p role="alert" className={styles.error}>
          {error}
        </p>
        <p role="status" className={styles.notice}>
          {notice}
        </p>

        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? t.pending : isSignup ? t.signup : t.login}
        </button>
      </form>

      <p className={styles.switch}>
        {isSignup ? t.haveAccount : t.noAccount}{' '}
        <button type="button" className={styles.link} onClick={switchMode}>
          {isSignup ? t.login : t.signup}
        </button>
      </p>
    </section>
  );
}
