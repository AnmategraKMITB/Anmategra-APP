import Link from 'next/link';

import {
  contactLink,
  Daftar,
  LegalPage,
  type LegalContent,
  type LegalLocale,
} from './legal-page';

export type PolicyLocale = LegalLocale;
export type PolicyContent = LegalContent;

const POLICY_URL =
  'https://developers.google.com/terms/api-services-user-data-policy';

const policyLink = (
  <Link
    href={POLICY_URL}
    className="underline underline-offset-2"
    rel="noopener noreferrer"
    target="_blank"
  >
    Google API Services User Data Policy
  </Link>
);

const homeLink = (
  <Link href="/" className="underline underline-offset-2">
    anmategra.com
  </Link>
);

export const PRIVACY_POLICY: Record<PolicyLocale, PolicyContent> = {
  id: {
    lang: 'id',
    href: '/privasi',
    title: 'Kebijakan Privasi',
    description:
      'Kebijakan Privasi Anmategra: data apa yang dikumpulkan, bagaimana data digunakan, dan bagaimana data Google API diperlakukan.',
    switchLabel: 'Read in English',
    switchHref: '/privacy',
    switchHrefLang: 'en',
    heading: 'Kebijakan Privasi Anmategra',
    effective: 'Berlaku sejak 16 November 2026',
    intro: (
      <p className="leading-relaxed text-slate-700">
        Anmategra adalah platform pendataan kemahasiswaan yang dikelola
        Kementerian Anmategra, Kemenkoan Pengembangan Sumber Daya Manusia (PSDM),
        Kabinet Keluarga Mahasiswa Institut Teknologi Bandung. Kebijakan ini
        menjelaskan data apa yang kami kumpulkan saat Anda menggunakan Anmategra
        di {homeLink}, bagaimana data itu digunakan, dan pilihan yang Anda miliki.
      </p>
    ),
    sections: [
      {
        title: '1. Tentang Anmategra',
        body: (
          <p>
            Anmategra membantu lembaga kemahasiswaan ITB — himpunan, unit kegiatan
            mahasiswa, dan kepanitiaan — mendata anggota, menyusun struktur
            organisasi, menyelenggarakan kegiatan, membuka pendaftaran, serta
            mengelola formulir dan penilaian. Sebagian besar fitur hanya dapat
            dipakai setelah masuk dengan akun kampus, tetapi halaman publik
            seperti beranda, profil lembaga, profil kegiatan, manual, dan halaman
            ini dapat dibaca tanpa masuk.
          </p>
        ),
      },
      {
        title: '2. Data yang kami kumpulkan',
        body: (
          <>
            <p>
              Kami hanya mengumpulkan data yang diperlukan untuk menjalankan
              layanan. Bergantung pada peran dan fitur yang Anda pakai, data
              tersebut meliputi:
            </p>
            <Daftar>
              <li>
                <strong>Data identitas dan akun.</strong> Nama, alamat email,
                foto profil, dan peran akun. Mahasiswa masuk lewat Microsoft
                Entra ID ITB; pengelola lembaga dapat masuk lewat Google.
              </li>
              <li>
                <strong>Data kemahasiswaan dan organisasi.</strong> NIM, program
                studi, angkatan, keanggotaan lembaga, serta jabatan dalam
                struktur kepanitiaan.
              </li>
              <li>
                <strong>Konten yang Anda kirim.</strong> Jawaban formulir, berkas
                lampiran, gambar, dan tulisan yang Anda isi pada formulir
                pendaftaran atau penilaian.
              </li>
              <li>
                <strong>Data teknis.</strong> Waktu akses, alamat IP, dan catatan
                audit tindakan administratif yang kami gunakan untuk keamanan dan
                penyelesaian sengketa.
              </li>
            </Daftar>
          </>
        ),
      },
      {
        title: '3. Data Google yang kami akses',
        body: (
          <>
            <p>
              Saat Anda masuk dengan akun Google, kami menerima nama, alamat
              email, dan foto profil dari Google untuk membuat dan mengenali akun
              Anda. Untuk itu kami meminta izin <code>openid</code>,{' '}
              <code>email</code>, dan <code>profile</code>.
            </p>
            <p>
              Jika pengelola formulir mengaktifkan penyimpanan berkas di Google
              Drive dan Anda memilih menghubungkan Drive Anda, kami juga meminta
              izin <code>https://www.googleapis.com/auth/drive.file</code>. Izin
              ini bersifat per-berkas: Anmategra hanya dapat membuat dan mengubah
              berkas yang dibuat oleh Anmategra sendiri. Kami tidak dapat melihat,
              membaca, atau mengubah berkas lain di Drive Anda.
            </p>
            <p>
              Pada alur tersebut, berkas jawaban diunggah langsung dari peramban
              Anda ke Google Drive milik Anda. Anmategra tidak menyimpan isi
              berkas. Kami hanya menyimpan tautan berkas, nama, ukuran, dan jenis
              berkasnya agar pengelola formulir dapat membukanya. Tautan dibuat
              dengan akses baca untuk siapa saja yang memiliki tautan; Anda dapat
              mengubah atau mencabut akses itu kapan saja dari Google Drive Anda.
            </p>
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              Penggunaan data yang kami terima dari Google API oleh Anmategra
              mematuhi {policyLink}, termasuk persyaratan Limited Use. Kami tidak
              menggunakan data Google untuk periklanan, tidak menjualnya kepada
              pihak ketiga, tidak menggunakannya untuk menentukan kelayakan kredit
              atau pinjaman, dan tidak menggunakannya untuk melatih model
              kecerdasan buatan.
            </p>
          </>
        ),
      },
      {
        title: '4. Cara kami menggunakan data',
        body: (
          <Daftar>
            <li>Mengautentikasi Anda dan menentukan hak akses sesuai peran.</li>
            <li>
              Menampilkan profil lembaga, kegiatan, dan anggota kepada pengguna
              lain di lingkungan KM ITB.
            </li>
            <li>
              Menyimpan dan menampilkan jawaban formulir serta hasil penilaian
              kepada pengelola yang berwenang.
            </li>
            <li>Menyusun laporan kegiatan dan rekapitulasi keanggotaan.</li>
            <li>
              Menjaga keamanan layanan, mencegah penyalahgunaan, dan menyelesaikan
              sengketa kepemilikan akun.
            </li>
            <li>Memperbaiki kualitas layanan secara agregat.</li>
          </Daftar>
        ),
      },
      {
        title: '5. Pembagian data kepada pihak lain',
        body: (
          <>
            <p>
              Kami tidak menjual data Anda. Data hanya dibagikan dalam keadaan
              berikut:
            </p>
            <Daftar>
              <li>
                <strong>Pengelola yang berwenang.</strong> Pengurus lembaga atau
                kepanitiaan dapat melihat data yang Anda kirimkan kepada mereka,
                termasuk jawaban formulir dan hasil penilaian.
              </li>
              <li>
                <strong>Penyedia layanan teknis.</strong> Kami memakai penyedia
                infrastruktur dan penyimpanan gambar untuk menjalankan layanan.
                Mereka memproses data atas nama kami dan hanya sebatas keperluan
                teknis.
              </li>
              <li>
                <strong>Kewajiban hukum.</strong> Kami dapat mengungkapkan data
                bila diwajibkan oleh peraturan yang berlaku atau permintaan resmi
                Institut Teknologi Bandung.
              </li>
            </Daftar>
          </>
        ),
      },
      {
        title: '6. Penyimpanan dan masa retensi',
        body: (
          <Daftar>
            <li>
              Data akun dan keanggotaan disimpan selama akun aktif atau selama
              diperlukan untuk keperluan organisasi.
            </li>
            <li>
              Jawaban formulir dan hasil penilaian disimpan selama periode
              kegiatan berlangsung dan untuk keperluan arsip organisasi.
            </li>
            <li>
              Foto KTM pada pengajuan akses alternatif dihapus otomatis setelah 7
              hari; yang tersisa hanya catatan klaim.
            </li>
            <li>
              Catatan audit disimpan untuk keperluan keamanan dan dapat dihapus
              setelah tidak diperlukan.
            </li>
          </Daftar>
        ),
      },
      {
        title: '7. Keamanan',
        body: (
          <p>
            Kami menerapkan langkah teknis dan organisasi untuk melindungi data,
            antara lain koneksi terenkripsi, pembatasan akses berdasarkan peran,
            penyimpanan rahasia dalam bentuk hash, dan pencatatan tindakan
            administratif. Tidak ada sistem yang sepenuhnya bebas risiko, tetapi
            kami meninjau dan memperbarui pengamanan secara berkala.
          </p>
        ),
      },
      {
        title: '8. Hak Anda',
        body: (
          <>
            <Daftar>
              <li>Meminta salinan data pribadi yang kami simpan tentang Anda.</li>
              <li>Meminta perbaikan data yang tidak akurat.</li>
              <li>
                Meminta penghapusan data, sepanjang tidak bertentangan dengan
                kewajiban arsip organisasi.
              </li>
              <li>
                Mencabut akses Anmategra ke akun Google Anda kapan saja melalui
                halaman izin akun Google Anda.
              </li>
            </Daftar>
            <p>
              Permintaan dapat dikirim ke {contactLink}. Kami akan menindaklanjuti
              dalam waktu yang wajar.
            </p>
          </>
        ),
      },
      {
        title: '9. Perubahan kebijakan',
        body: (
          <p>
            Kebijakan ini dapat diperbarui bila layanan atau ketentuan yang
            berlaku berubah. Versi terbaru selalu tersedia di halaman ini beserta
            tanggal berlakunya.
          </p>
        ),
      },
      {
        title: '10. Hubungi kami',
        body: (
          <p>
            Pertanyaan tentang kebijakan ini dapat disampaikan kepada Kementerian
            Anmategra KM ITB melalui {contactLink}.
          </p>
        ),
      },
    ],
    related: [
      { href: '/ketentuan', label: 'Syarat dan Ketentuan Layanan' },
      { href: '/privacy', label: 'Read this policy in English' },
    ],
  },
  en: {
    lang: 'en',
    href: '/privacy',
    title: 'Privacy Policy',
    description:
      'Anmategra Privacy Policy: what data we collect, how we use it, and how Google API data is handled.',
    switchLabel: 'Baca dalam Bahasa Indonesia',
    switchHref: '/privasi',
    switchHrefLang: 'id',
    heading: 'Anmategra Privacy Policy',
    effective: 'Effective 16 November 2026',
    intro: (
      <p className="leading-relaxed text-slate-700">
        Anmategra is a student-organization data platform operated by the
        Anmategra Ministry, Human Resources Development Coordinating Ministry
        (PSDM), Student Cabinet of Keluarga Mahasiswa Institut Teknologi Bandung.
        This policy explains what data we collect when you use Anmategra at{' '}
        {homeLink}, how that data is used, and the choices available to you.
      </p>
    ),
    sections: [
      {
        title: '1. About Anmategra',
        body: (
          <p>
            Anmategra helps ITB student organizations — student associations,
            student activity units, and event committees — record their
            membership, lay out their organizational structure, run events, open
            recruitment, and manage forms and assessments. Most features require
            signing in with a campus account, but public pages such as the
            homepage, organization profiles, event profiles, the manual, and this
            page can be read without signing in.
          </p>
        ),
      },
      {
        title: '2. Data we collect',
        body: (
          <>
            <p>
              We only collect the data needed to operate the service. Depending
              on your role and the features you use, that data includes:
            </p>
            <Daftar>
              <li>
                <strong>Identity and account data.</strong> Name, email address,
                profile photo, and account role. Students sign in through ITB
                Microsoft Entra ID; organization managers may sign in with Google.
              </li>
              <li>
                <strong>Student and organization data.</strong> Student ID number
                (NIM), study program, cohort year, organization membership, and
                positions held in committee structures.
              </li>
              <li>
                <strong>Content you submit.</strong> Form answers, attached files,
                images, and text you enter in registration or assessment forms.
              </li>
              <li>
                <strong>Technical data.</strong> Access times, IP addresses, and
                audit records of administrative actions, used for security and
                dispute resolution.
              </li>
            </Daftar>
          </>
        ),
      },
      {
        title: '3. Google data we access',
        body: (
          <>
            <p>
              When you sign in with a Google account, we receive your name, email
              address, and profile photo from Google in order to create and
              recognize your account. For this we request the <code>openid</code>,{' '}
              <code>email</code>, and <code>profile</code> scopes.
            </p>
            <p>
              If a form manager enables file storage in Google Drive and you choose
              to connect your Drive, we also request the{' '}
              <code>https://www.googleapis.com/auth/drive.file</code> scope. This
              scope is per-file: Anmategra can only create and modify files it
              created itself. We cannot see, read, or modify any other files in
              your Drive.
            </p>
            <p>
              In that flow, answer files are uploaded directly from your browser to
              your own Google Drive. Anmategra does not store file contents. We
              store only the file link, name, size, and type so that the form
              manager can open it. Links are created with view access for anyone
              with the link; you can change or revoke that access at any time from
              your Google Drive.
            </p>
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              Anmategra&apos;s use of data received from Google APIs complies with
              the {policyLink}, including the Limited Use requirements. We do not
              use Google data for advertising, do not sell it to third parties, do
              not use it to determine credit or lending eligibility, and do not use
              it to train artificial intelligence models.
            </p>
          </>
        ),
      },
      {
        title: '4. How we use data',
        body: (
          <Daftar>
            <li>To authenticate you and set access rights according to role.</li>
            <li>
              To display organization, event, and member profiles to other users
              within the KM ITB community.
            </li>
            <li>
              To store and show form answers and assessment results to authorized
              managers.
            </li>
            <li>To compile event reports and membership recaps.</li>
            <li>
              To keep the service secure, prevent misuse, and resolve account
              ownership disputes.
            </li>
            <li>To improve service quality in aggregate.</li>
          </Daftar>
        ),
      },
      {
        title: '5. Sharing data with others',
        body: (
          <>
            <p>We do not sell your data. Data is shared only in these cases:</p>
            <Daftar>
              <li>
                <strong>Authorized managers.</strong> Organization or committee
                officers can see the data you submit to them, including form
                answers and assessment results.
              </li>
              <li>
                <strong>Technical service providers.</strong> We use
                infrastructure and image storage providers to run the service.
                They process data on our behalf and only as far as technically
                necessary.
              </li>
              <li>
                <strong>Legal obligations.</strong> We may disclose data where
                required by applicable regulations or an official request from
                Institut Teknologi Bandung.
              </li>
            </Daftar>
          </>
        ),
      },
      {
        title: '6. Storage and retention',
        body: (
          <Daftar>
            <li>
              Account and membership data is kept while the account is active or
              as long as needed for organizational purposes.
            </li>
            <li>
              Form answers and assessment results are kept for the duration of the
              event period and for organizational archiving.
            </li>
            <li>
              Student ID card photos submitted for alternative access are deleted
              automatically after 7 days; only the claim record remains.
            </li>
            <li>
              Audit records are kept for security purposes and may be deleted once
              no longer needed.
            </li>
          </Daftar>
        ),
      },
      {
        title: '7. Security',
        body: (
          <p>
            We apply technical and organizational measures to protect data,
            including encrypted connections, role-based access restrictions,
            hashed storage of secrets, and logging of administrative actions. No
            system is entirely free of risk, but we review and update our
            safeguards periodically.
          </p>
        ),
      },
      {
        title: '8. Your rights',
        body: (
          <>
            <Daftar>
              <li>A copy of the personal data we hold about you.</li>
              <li>Correction of inaccurate data.</li>
              <li>
                Deletion of your data, where this does not conflict with
                organizational archiving obligations.
              </li>
              <li>
                Revoking Anmategra&apos;s access to your Google account at any
                time through your Google account permissions page.
              </li>
            </Daftar>
            <p>
              Requests can be sent to {contactLink}. We will respond within a
              reasonable time.
            </p>
          </>
        ),
      },
      {
        title: '9. Changes to this policy',
        body: (
          <p>
            This policy may be updated if the service or applicable rules change.
            The latest version is always available on this page together with its
            effective date.
          </p>
        ),
      },
      {
        title: '10. Contact us',
        body: (
          <p>
            Questions about this policy can be sent to the Anmategra Ministry, KM
            ITB, at {contactLink}.
          </p>
        ),
      },
    ],
    related: [
      { href: '/terms', label: 'Terms of Service' },
      { href: '/privasi', label: 'Baca kebijakan ini dalam Bahasa Indonesia' },
    ],
  },
};

export function PrivacyPolicyPage({ locale }: { locale: PolicyLocale }) {
  return <LegalPage content={PRIVACY_POLICY[locale]} />;
}
