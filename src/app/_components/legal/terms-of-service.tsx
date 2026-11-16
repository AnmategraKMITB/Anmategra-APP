import Link from 'next/link';

import {
  contactLink,
  Daftar,
  LegalPage,
  type LegalContent,
  type LegalLocale,
} from './legal-page';

export type TermsLocale = LegalLocale;
export type TermsContent = LegalContent;

export const TERMS_OF_SERVICE: Record<TermsLocale, TermsContent> = {
  id: {
    lang: 'id',
    href: '/ketentuan',
    title: 'Syarat dan Ketentuan Layanan',
    description:
      'Syarat dan ketentuan penggunaan platform Anmategra KM ITB: aturan pemakaian, tanggung jawab akun, dan ketentuan akses alternatif.',
    switchLabel: 'Read in English',
    switchHref: '/terms',
    switchHrefLang: 'en',
    heading: 'Syarat dan Ketentuan Layanan',
    effective: 'Berlaku sejak 16 November 2026',
    intro: (
      <p className="leading-relaxed text-slate-700">
        Syarat dan Ketentuan ini mengatur penggunaan platform Anmategra yang
        dikelola Kementerian Anmategra, Kemenkoan Pengembangan Sumber Daya
        Manusia (PSDM), Kabinet Keluarga Mahasiswa Institut Teknologi Bandung.
        Dengan mengakses atau memakai Anmategra, Anda menyatakan telah membaca dan
        menyetujui ketentuan ini. Bila Anda tidak menyetujuinya, mohon tidak
        menggunakan layanan.
      </p>
    ),
    sections: [
      {
        title: '1. Layanan yang kami sediakan',
        body: (
          <p>
            Anmategra adalah platform pendataan kemahasiswaan untuk lingkungan
            KM ITB. Layanan mencakup profil lembaga dan kegiatan, keanggotaan
            organisasi, formulir dan pendaftaran, struktur kepanitiaan, serta
            penilaian seleksi. Sebagian fitur hanya tersedia setelah masuk dengan
            akun kampus, dan sebagian lagi hanya untuk pengurus dengan peran
            tertentu.
          </p>
        ),
      },
      {
        title: '2. Kelayakan dan akun',
        body: (
          <>
            <Daftar>
              <li>
                Mahasiswa masuk menggunakan akun Microsoft Entra ID ITB
                berdomain <code>@mahasiswa.itb.ac.id</code>, dan pengelola lembaga
                dapat masuk menggunakan akun Google yang telah diverifikasi.
              </li>
              <li>
                Anda bertanggung jawab menjaga kerahasiaan kredensial akun serta
                seluruh aktivitas yang terjadi melalui akun tersebut.
              </li>
              <li>
                Anda wajib memberikan informasi yang benar. Data yang sengaja
                dipalsukan dapat menyebabkan penangguhan akses.
              </li>
              <li>
                Satu orang tidak diperkenankan membuat atau memakai lebih dari
                satu akun untuk mengakali kuota, penilaian, atau hak akses.
              </li>
            </Daftar>
          </>
        ),
      },
      {
        title: '3. Akses alternatif',
        body: (
          <>
            <p>
              Mahasiswa yang akun kampusnya bermasalah dapat mengajukan akses
              alternatif dengan memasukkan email kontak, NIM, dan foto Kartu Tanda
              Mahasiswa (KTM). Ketentuan berikut berlaku:
            </p>
            <Daftar>
              <li>
                Email kontak yang Anda masukkan tidak diverifikasi, sehingga sesi
                akses alternatif hanya berlaku untuk mengisi formulir dan tidak
                memberi akses lain.
              </li>
              <li>
                Sesi akses alternatif berlaku paling lama 6 jam sejak klaim
                dibuat. Login Microsoft yang berhasil akan otomatis mencabutnya.
              </li>
              <li>
                Foto KTM dihapus otomatis setelah 7 hari; yang tersisa hanya
                catatan klaim.
              </li>
              <li>
                NIM yang sama yang diklaim pihak lain dalam 24 jam terakhir
                dianggap sengketa. Semua pihak ditahan hingga admin memutuskan,
                dan keputusan admin bersifat final.
              </li>
              <li>
                Pengajuan dibatasi maksimal 3 klaim per email per hari dan 10
                klaim per jaringan per jam.
              </li>
              <li>
                Memakai NIM milik orang lain, atau mengunggah KTM yang bukan milik
                Anda, merupakan pelanggaran berat dan menyebabkan pencabutan akses
                serta pelaporan kepada pihak yang berwenang di ITB.
              </li>
            </Daftar>
          </>
        ),
      },
      {
        title: '4. Penggunaan yang dilarang',
        body: (
          <>
            <p>Anda tidak diperkenankan:</p>
            <Daftar>
              <li>
                Mengakses data yang bukan hak Anda, termasuk mencoba melewati
                pembatasan peran atau menebak tautan formulir milik lembaga lain.
              </li>
              <li>
                Mengunggah konten yang melanggar hukum, mengandung malware, atau
                melanggar hak cipta dan hak pribadi orang lain.
              </li>
              <li>
                Mengganggu ketersediaan layanan, termasuk memindai kerentanan,
                membebani server secara berlebihan, atau mengotomatiskan
                permintaan di luar batas wajar.
              </li>
              <li>
                Mengambil data secara massal (<em>scraping</em>) untuk keperluan
                di luar kegiatan kemahasiswaan KM ITB.
              </li>
              <li>
                Memakai layanan untuk kampanye politik praktis, periklanan
                komersial, atau kegiatan yang tidak berkaitan dengan KM ITB.
              </li>
            </Daftar>
          </>
        ),
      },
      {
        title: '5. Konten dan kepemilikan',
        body: (
          <>
            <p>
              Anda tetap memiliki hak atas konten yang Anda unggah, seperti
              jawaban formulir, foto, dan berkas lampiran. Dengan mengunggahnya,
              Anda memberi Anmategra izin untuk menyimpan, menampilkan, dan
              memproses konten tersebut sebatas keperluan penyelenggaraan layanan
              dan kegiatan organisasi terkait.
            </p>
            <p>
              Kode sumber Anmategra terbuka di bawah Lisensi AGPL-3.0. Lisensi itu
              mengatur penggunaan kode, bukan penggunaan layanan; ketentuan pada
              halaman ini yang mengatur penggunaan layanan.
            </p>
            <p>
              Berkas yang diunggah melalui Google Drive tetap berada di akun Drive
              Anda. Anmategra hanya menyimpan tautannya, sebagaimana dijelaskan di{' '}
              <Link
                href="/privasi"
                className="underline underline-offset-2 hover:opacity-80"
              >
                Kebijakan Privasi
              </Link>
              .
            </p>
          </>
        ),
      },
      {
        title: '6. Ketersediaan layanan',
        body: (
          <p>
            Anmategra dijalankan oleh mahasiswa sebagai bagian dari kegiatan
            kemahasiswaan, bukan layanan komersial. Layanan disediakan
            &ldquo;sebagaimana adanya&rdquo; tanpa jaminan ketersediaan
            berkelanjutan, dan dapat dihentikan, diubah, atau dipulihkan dari
            cadangan kapan saja untuk keperluan pemeliharaan atau perbaikan. Kami
            berupaya menjaga data dengan baik, tetapi tidak menjamin bahwa data
            tidak akan pernah hilang. Untuk berkas penting, simpan salinan Anda
            sendiri.
          </p>
        ),
      },
      {
        title: '7. Penangguhan dan penghentian',
        body: (
          <p>
            Kami dapat membatasi, menangguhkan, atau menghentikan akses Anda bila
            Anda melanggar ketentuan ini, memanipulasi data atau penilaian, atau
            bila diperlukan untuk melindungi pengguna lain. Bila terjadi
            sengketa kepemilikan akun, admin dapat meminta bukti tambahan dan
            keputusannya bersifat final. Anda dapat berhenti menggunakan layanan
            kapan saja.
          </p>
        ),
      },
      {
        title: '8. Batasan tanggung jawab',
        body: (
          <p>
            Sepanjang diizinkan hukum yang berlaku, Kementerian Anmategra KM ITB
            dan Institut Teknologi Bandung tidak bertanggung jawab atas kerugian
            tidak langsung atau konsekuensial yang timbul dari penggunaan layanan,
            termasuk kehilangan data, kegagalan unggahan, atau keputusan seleksi
            yang diambil oleh pengelola lembaga. Keputusan penerimaan anggota,
            penilaian, dan hasil seleksi sepenuhnya berada pada lembaga atau
            kepanitiaan yang bersangkutan.
          </p>
        ),
      },
      {
        title: '9. Perubahan ketentuan',
        body: (
          <p>
            Ketentuan ini dapat diperbarui sewaktu-waktu. Versi terbaru selalu
            tersedia di halaman ini beserta tanggal berlakunya. Penggunaan layanan
            setelah pembaruan berarti Anda menyetujui ketentuan yang berlaku saat
            itu.
          </p>
        ),
      },
      {
        title: '10. Hukum yang berlaku dan kontak',
        body: (
          <>
            <p>
              Ketentuan ini tunduk pada hukum yang berlaku di Republik Indonesia.
              Pertanyaan tentang ketentuan ini dapat disampaikan kepada
              Kementerian Anmategra KM ITB melalui {contactLink}.
            </p>
          </>
        ),
      },
    ],
    related: [
      { href: '/privasi', label: 'Kebijakan Privasi' },
      { href: '/terms', label: 'Read these terms in English' },
    ],
  },
  en: {
    lang: 'en',
    href: '/terms',
    title: 'Terms of Service',
    description:
      'Terms of service for the Anmategra KM ITB platform: acceptable use, account responsibilities, and alternative access rules.',
    switchLabel: 'Baca dalam Bahasa Indonesia',
    switchHref: '/ketentuan',
    switchHrefLang: 'id',
    heading: 'Terms of Service',
    effective: 'Effective 16 November 2026',
    intro: (
      <p className="leading-relaxed text-slate-700">
        These Terms of Service govern your use of the Anmategra platform, operated
        by the Anmategra Ministry, Human Resources Development Coordinating
        Ministry (PSDM), Student Cabinet of Keluarga Mahasiswa Institut Teknologi
        Bandung. By accessing or using Anmategra, you confirm that you have read
        and agree to these terms. If you do not agree, please do not use the
        service.
      </p>
    ),
    sections: [
      {
        title: '1. The service we provide',
        body: (
          <p>
            Anmategra is a student-organization data platform for the KM ITB
            community. The service covers organization and event profiles,
            membership, forms and registration, committee structures, and selection
            assessments. Some features require signing in with a campus account,
            and some are limited to officers with specific roles.
          </p>
        ),
      },
      {
        title: '2. Eligibility and accounts',
        body: (
          <Daftar>
            <li>
              Students sign in with an ITB Microsoft Entra ID account in the{' '}
              <code>@mahasiswa.itb.ac.id</code> domain, and organization managers
              may sign in with a verified Google account.
            </li>
            <li>
              You are responsible for keeping your account credentials
              confidential and for all activity that occurs through your account.
            </li>
            <li>
              You must provide accurate information. Deliberately falsified data
              may result in suspension of access.
            </li>
            <li>
              You may not create or use more than one account to circumvent quotas,
              assessments, or access rights.
            </li>
          </Daftar>
        ),
      },
      {
        title: '3. Alternative access',
        body: (
          <>
            <p>
              Students whose campus account is not working may request alternative
              access by submitting a contact email, student ID number (NIM), and a
              photo of their student ID card (KTM). The following applies:
            </p>
            <Daftar>
              <li>
                The contact email you enter is not verified, so an alternative
                access session only permits filling in forms and grants no other
                access.
              </li>
              <li>
                An alternative access session lasts at most 6 hours from the time
                the claim is created. A successful Microsoft login revokes it
                automatically.
              </li>
              <li>
                The student ID card photo is deleted automatically after 7 days;
                only the claim record remains.
              </li>
              <li>
                A NIM claimed by another party within the last 24 hours is treated
                as a dispute. All parties are held until an admin decides, and the
                admin&apos;s decision is final.
              </li>
              <li>
                Submissions are limited to 3 claims per email per day and 10 claims
                per network per hour.
              </li>
              <li>
                Using someone else&apos;s NIM, or uploading a student ID card that
                is not yours, is a serious violation and will result in revoked
                access and a report to the relevant ITB authority.
              </li>
            </Daftar>
          </>
        ),
      },
      {
        title: '4. Prohibited use',
        body: (
          <>
            <p>You may not:</p>
            <Daftar>
              <li>
                Access data you are not entitled to, including attempting to bypass
                role restrictions or guess links to another organization&apos;s
                forms.
              </li>
              <li>
                Upload content that is unlawful, contains malware, or infringes the
                copyright or privacy rights of others.
              </li>
              <li>
                Disrupt service availability, including scanning for
                vulnerabilities, overloading the server, or automating requests
                beyond reasonable limits.
              </li>
              <li>
                Scrape data in bulk for purposes unrelated to KM ITB student
                activities.
              </li>
              <li>
                Use the service for practical political campaigning, commercial
                advertising, or activities unrelated to KM ITB.
              </li>
            </Daftar>
          </>
        ),
      },
      {
        title: '5. Content and ownership',
        body: (
          <>
            <p>
              You retain your rights to content you upload, such as form answers,
              photos, and attachments. By uploading it, you grant Anmategra
              permission to store, display, and process that content as far as
              needed to operate the service and the related organizational
              activities.
            </p>
            <p>
              Anmategra&apos;s source code is open under the AGPL-3.0 License. That
              license governs use of the code, not use of the service; these terms
              govern use of the service.
            </p>
            <p>
              Files uploaded through Google Drive remain in your own Drive account.
              Anmategra stores only the link, as described in the Privacy Policy.
            </p>
          </>
        ),
      },
      {
        title: '6. Service availability',
        body: (
          <p>
            Anmategra is run by students as part of student activities, not as a
            commercial service. The service is provided &ldquo;as is&rdquo; without
            any guarantee of continuous availability, and may be stopped, changed,
            or restored from backup at any time for maintenance or repair. We take
            reasonable care of your data but cannot guarantee it will never be
            lost. Keep your own copy of important files.
          </p>
        ),
      },
      {
        title: '7. Suspension and termination',
        body: (
          <p>
            We may restrict, suspend, or terminate your access if you violate these
            terms, manipulate data or assessments, or where necessary to protect
            other users. In an account ownership dispute, an admin may request
            additional evidence and the decision is final. You may stop using the
            service at any time.
          </p>
        ),
      },
      {
        title: '8. Limitation of liability',
        body: (
          <p>
            To the extent permitted by applicable law, the Anmategra Ministry, KM
            ITB, and Institut Teknologi Bandung are not liable for indirect or
            consequential losses arising from use of the service, including data
            loss, upload failures, or selection decisions made by organization
            managers. Decisions on admission, assessment, and selection results
            rest entirely with the organization or committee concerned.
          </p>
        ),
      },
      {
        title: '9. Changes to these terms',
        body: (
          <p>
            These terms may be updated from time to time. The latest version is
            always available on this page together with its effective date. Using
            the service after an update means you accept the terms then in effect.
          </p>
        ),
      },
      {
        title: '10. Governing law and contact',
        body: (
          <p>
            These terms are governed by the laws of the Republic of Indonesia.
            Questions about these terms can be sent to the Anmategra Ministry, KM
            ITB, at {contactLink}.
          </p>
        ),
      },
    ],
    related: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/ketentuan', label: 'Baca ketentuan ini dalam Bahasa Indonesia' },
    ],
  },
};

export function TermsOfServicePage({ locale }: { locale: TermsLocale }) {
  return <LegalPage content={TERMS_OF_SERVICE[locale]} />;
}
