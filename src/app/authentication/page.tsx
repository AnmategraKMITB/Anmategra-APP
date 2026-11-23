'use client';

// Library Import
import { signIn } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import Google from 'public/icons/google-icon.webp';
import Microsoft from 'public/icons/microsoft-icon.webp';
import React from 'react';
import { DemoLoginForm } from '~/app/_components/auth/demo-login-form';
import { Button } from '~/components/ui/button';
// Components Import
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { pickFormsCallback } from '~/lib/forms-path';

// Asset Import
import Logo from '../../../public/images/logo/anmategra-logo-full.png';

// Tautan form yang dibuka sebelum login: kembali ke sana setelah masuk (hanya
// jalur isi form `/forms/...` dan `/f/...`, supaya tidak bisa dipakai sebagai
// pengalihan terbuka).
const signInTo = (provider: 'azure-ad' | 'google') => {
  const callbackUrl = pickFormsCallback(window.location.search);
  return signIn(provider, callbackUrl ? { callbackUrl } : undefined);
};

const LogInPage = () => {
  const isDemo = process.env.NEXT_PUBLIC_APP_ENV === 'demo';
  return (
    <div className="flex h-screen w-full items-center justify-center gap-x-4 bg-slate-100 px-4">
      <Card className="w-full max-w-[450px]">
        <CardHeader className="space-y-3">
          <CardTitle className="flex flex-col gap-y-2 text-xl sm:gap-y-3 sm:text-2xl">
            <Image
              src={Logo}
              width={125}
              height={250}
              alt="Logo Anmategra"
              className="h-auto w-[100px] sm:w-[125px]"
            />
            <p className="text-lg leading-tight sm:text-2xl">
              Selamat Datang di{' '}
              <span className="bg-gradient-to-br from-primary-400 to-secondary-400 bg-clip-text font-bold text-transparent">
                Anmategra
              </span>
            </p>
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {isDemo
              ? 'Masuk dengan akun demo yang diberikan panitia. Data demo terpisah dari produksi.'
              : 'Silahkan masuk dengan akun microsoft untuk mahasiswa dan akun google untuk lembaga.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-y-2 sm:gap-y-3">
          {isDemo ? (
            <DemoLoginForm />
          ) : (
            <>
              <Button
                onClick={() => signInTo('azure-ad')}
                variant={'outline'}
                className="flex h-auto items-center justify-center gap-x-2 px-3 py-3 transition-all hover:gap-x-3 sm:px-4"
              >
                <Image
                  src={Microsoft}
                  alt="Logo Microsoft"
                  width={16}
                  height={16}
                  className="flex-shrink-0"
                />
                <span className="text-xs text-slate-600 sm:text-sm">
                  Microsoft | @mahasiswa.itb.ac.id
                </span>
              </Button>
              <Button
                onClick={() => signInTo('google')}
                variant={'outline'}
                className="flex h-auto items-center justify-center gap-x-2 px-3 py-3 transition-all hover:gap-x-3 sm:px-4"
              >
                <Image
                  src={Google}
                  alt="Logo Google"
                  width={14}
                  height={14}
                  className="flex-shrink-0"
                />
                <span className="text-xs text-slate-600 sm:text-sm">
                  Google | @km.itb.ac.id
                </span>
              </Button>
              {process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID ? (
                <p className="text-center text-xs text-slate-500">
                  Akun ITB (@mahasiswa.itb.ac.id) kamu bermasalah?{' '}
                  <Link
                    href="/authentication/alternatif"
                    // Bawa callbackUrl form yang dibuka sebelum login.
                    onClick={(event) => {
                      event.preventDefault();
                      window.location.assign(
                        `/authentication/alternatif${window.location.search}`,
                      );
                    }}
                    className="font-semibold text-primary-400 underline-offset-2 hover:underline"
                  >
                    Silakan klik di sini
                  </Link>
                  .
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LogInPage;
