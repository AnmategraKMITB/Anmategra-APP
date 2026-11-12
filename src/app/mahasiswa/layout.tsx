import { redirect } from 'next/navigation'
import React, { type ReactNode } from 'react'
// import Navbar from '../_components/layout/navbar'
import {getServerAuthSession} from "~/server/auth";
import { WidthWrapper } from '../_components/layout/width-wrapper';

const HalamanMahasiswaLayout = async ({ children }: { children: ReactNode }) => {
    const session = await getServerAuthSession()
    // Lapisan kedua setelah middleware: area ini hanya untuk akun mahasiswa.
    if (!session) redirect('/authentication')
    if (session.user.role !== 'mahasiswa') redirect(`/${session.user.role}`)
  return (
    // <div className='flex flex-col items-center'>
    //   <div className="sticky top-0 w-full shadow-sm z-20">
    //     <Navbar session={session} />
    //   </div>
    //   <div className='w-full max-w-7xl mb-10'>
    //     {children}
    //   </div>
    // </div>
    <WidthWrapper session={session} landingPath="/mahasiswa">
      {children}
    </WidthWrapper>
  )
};

export default HalamanMahasiswaLayout;