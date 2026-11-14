"use client"

// Library Import
import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
// Components Import
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
// Asset Import
import Logo from '../../../public/images/logo/anmategra-logo-full.png'
import Google from 'public/icons/google-icon.webp'
import Microsoft from 'public/icons/microsoft-icon.webp'

import { signIn } from "next-auth/react";
import { DemoLoginForm } from "~/app/_components/auth/demo-login-form";
import { pickFormsCallback } from "~/lib/forms-path";

// Tautan form yang dibuka sebelum login: kembali ke sana setelah masuk (hanya
// jalur /forms/..., supaya tidak bisa dipakai sebagai pengalihan terbuka).
const signInTo = (provider: "azure-ad" | "google") => {
  const callbackUrl = pickFormsCallback(window.location.search);
  return signIn(provider, callbackUrl ? { callbackUrl } : undefined);
};

const LogInPage = () => {
  const isDemo = process.env.NEXT_PUBLIC_APP_ENV === 'demo';
  return (
    <div className='h-screen w-full flex items-center justify-center gap-x-4 bg-slate-100 px-4'>
      <Card className='max-w-[450px] w-full'>
        <CardHeader className='space-y-3'>
          <CardTitle className='text-xl sm:text-2xl flex flex-col gap-y-2 sm:gap-y-3'>
            <Image 
              src={Logo}
              width={125}
              height={250}
              alt='Logo Anmategra'
              className='w-[100px] sm:w-[125px] h-auto'
            />
            <p className='text-lg sm:text-2xl leading-tight'>Selamat Datang di <span className='bg-clip-text text-transparent bg-gradient-to-br from-primary-400 to-secondary-400 font-bold'>Anmategra</span></p>
          </CardTitle>
          <CardDescription className='text-xs sm:text-sm'>
            {isDemo
              ? 'Masuk dengan akun demo yang diberikan panitia. Data demo terpisah dari produksi.'
              : 'Silahkan masuk dengan akun microsoft untuk mahasiswa dan akun google untuk lembaga.'}
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-y-2 sm:gap-y-3'>
          {isDemo ? (
            <DemoLoginForm />
          ) : (
            <>
          <Button onClick={() => signInTo("azure-ad")} variant={"outline"} className='flex items-center justify-center gap-x-2 transition-all hover:gap-x-3 h-auto py-3 px-3 sm:px-4'>
            <Image
              src={Microsoft}
              alt='Logo Microsoft'
              width={16}
              height={16}
              className='flex-shrink-0'
            /> 
            <span className='text-slate-600 text-xs sm:text-sm'>
              Microsoft  |  @mahasiswa.itb.ac.id
            </span>
          </Button>
          <Button onClick={() => signInTo("google")} variant={"outline"} className='flex items-center justify-center gap-x-2 transition-all hover:gap-x-3 h-auto py-3 px-3 sm:px-4'>
            <Image 
              src={Google}
              alt='Logo Google'
              width={14}
              height={14}
              className='flex-shrink-0'
            />
            <span className='text-slate-600 text-xs sm:text-sm'>
              Google  |  @km.itb.ac.id
            </span>
          </Button>
          {process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID ? (
            <p className='text-xs text-slate-500 text-center'>
              Akun ITB (@mahasiswa.itb.ac.id) kamu bermasalah?{' '}
              <Link
                href='/authentication/alternatif'
                // Bawa callbackUrl form yang dibuka sebelum login.
                onClick={(event) => {
                  event.preventDefault();
                  window.location.assign(`/authentication/alternatif${window.location.search}`);
                }}
                className='font-semibold text-primary-400 underline-offset-2 hover:underline'
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
  )
}

export default LogInPage