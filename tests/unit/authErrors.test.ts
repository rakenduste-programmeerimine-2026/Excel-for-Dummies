import { describe, expect, it } from 'vitest';
import { authErrorMessage } from '@/app/(auth)/login/authErrors';
import { ui } from '@/lib/strings.et';

const t = ui.auth.errors;

describe('authErrorMessage', () => {
  it.each([
    ['invalid_credentials', t.invalidCredentials],
    ['user_already_exists', t.userExists],
    ['email_exists', t.userExists],
    ['weak_password', t.weakPassword],
    ['email_not_confirmed', t.emailNotConfirmed],
    ['email_address_invalid', t.emailInvalid],
    ['over_request_rate_limit', t.rateLimit],
    ['over_email_send_rate_limit', t.rateLimit],
  ])('maps %s to Estonian text', (code, expected) => {
    expect(authErrorMessage({ code, name: 'AuthApiError' })).toBe(expected);
  });

  it('reports a network failure', () => {
    expect(authErrorMessage({ name: 'AuthRetryableFetchError' })).toBe(t.network);
  });

  it('never shows an unknown English message', () => {
    expect(authErrorMessage({ code: 'something_new', name: 'AuthApiError' })).toBe(t.unknown);
    expect(authErrorMessage({})).toBe(t.unknown);
  });
});
