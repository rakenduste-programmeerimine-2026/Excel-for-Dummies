import type { Metadata } from 'next';
import { ui } from '@/lib/strings.et';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: `${ui.auth.login} · ${ui.appName}` };

export default function LoginPage() {
  return <LoginForm />;
}
