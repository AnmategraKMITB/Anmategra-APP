'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

/** Login khusus deployment demo; tidak pernah dirender saat APP_ENV production. */
export function DemoLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    setPending(false);
    if (result?.error) {
      setError('Email atau password demo salah, atau akun bukan akun demo.');
      return;
    }
    window.location.assign(result?.url ?? '/');
  };

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label className="grid gap-1 text-sm font-semibold text-neutral-700">
        Email demo
        <Input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="demo.mahasiswa@demo.anmategra.local"
          required
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-neutral-700">
        Password demo
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-danger-dark">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="dark_blue" disabled={pending}>
        {pending ? 'Masuk…' : 'Masuk ke demo'}
      </Button>
      <p className="text-xs text-neutral-700">
        Ini deployment demo. Data di sini terpisah dari produksi.
      </p>
    </form>
  );
}
