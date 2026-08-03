import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Nav, Footer } from './Landing';

interface Section {
  heading?: string;
  paragraphs?: string[];
  list?: string[];
}

interface InfoProps {
  title: string;
  subtitle?: string;
  updatedAt?: string;
  sections: Section[];
}

export function InfoPage({ title, subtitle, updatedAt, sections }: InfoProps) {
  return (
    <div className="bg-white">
      <Nav />
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-32 sm:px-6 sm:pt-36 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke Beranda
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-3 text-lg text-slate-500">{subtitle}</p>}
        {updatedAt && <p className="mt-2 text-xs text-slate-400">Terakhir diperbarui: {updatedAt}</p>}
        <div className="mt-10 space-y-8">
          {sections.map((s) => (
            <section key={s.heading ?? 'intro'}>
              {s.heading && <h2 className="text-lg font-semibold text-slate-900">{s.heading}</h2>}
              {s.paragraphs?.map((p, i) => (
                <p key={i} className="mt-3 text-sm leading-relaxed text-slate-600">{p}</p>
              ))}
              {s.list && (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
                  {s.list.map((li, i) => (
                    <li key={i}>{li}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export function AboutPage() {
  return (
    <InfoPage
      title="Tentang DtmX"
      subtitle="Platform manajemen sosial media bertenaga AI untuk creator, tim, dan agensi."
      updatedAt="Agustus 2026"
      sections={[
        {
          paragraphs: [
            'DtmX lahir dari satu masalah sederhana: mengelola beberapa akun sosial media memakan waktu berjam-jam setiap minggu. Menulis caption, menjadwalkan posting, dan membalas komentar dilakukan di banyak tab yang berbeda.',
            'Kami membangun satu dashboard untuk semuanya — publikasi multi-platform, penjadwalan otomatis, inbox terpusat, dan asisten AI — sehingga kamu bisa fokus membuat konten, bukan mengurus operasionalnya.',
          ],
        },
        {
          heading: 'Misi Kami',
          paragraphs: [
            'Memberdayakan creator dan tim kecil agar mampu bersaing dengan agensi besar, tanpa harus menambah biaya atau staf. Teknologi hebat harus terasa sederhana.',
          ],
        },
        {
          heading: 'Nilai-Nilai',
          list: [
            'Sederhana — antarmuka bersih tanpa kebisingan.',
            'Transparan — harga jelas, tanpa biaya tersembunyi.',
            'Aman — data dan token selalu dienkripsi.',
            'Terus berkembang — fitur baru dirilis setiap bulan.',
          ],
        },
      ]}
    />
  );
}

export function BlogPage() {
  return (
    <InfoPage
      title="Blog DtmX"
      subtitle="Tips, wawasan, dan update fitur untuk mengelola sosial media lebih cerdas."
      updatedAt="Agustus 2026"
      sections={[
        {
          heading: 'Rekomendasi Waktu Posting Terbaik',
          paragraphs: [
            'Konsistensi lebih penting daripada kesempurnaan. Analisis kami menunjukkan akun yang posting 3-5 kali per minggu pada jam aktif audiens mendapat 2x lebih banyak engagement daripada yang hanya posting sekali-sekali.',
            'Gunakan fitur jadwal DtmX untuk menerbitkan konten otomatis, bahkan saat kamu sedang tidur.',
          ],
        },
        {
          heading: '5 Cara Memanfaatkan AI untuk Konten',
          paragraphs: [
            'AI bukan pengganti kreativitas, melainkan akselerator. Gunakan AI Studio DtmX untuk brainstorming ide, menyusun caption, dan menyarankan hashtag — lalu beri sentuhan pribadi sebelum terbit.',
          ],
        },
        {
          heading: 'Update Terbaru',
          list: [
            'Balasan AI kini mendukung nada suara kustom.',
            'Media library mendapat pencarian aset otomatis.',
            'Pembayaran Midtrans dan TriPay tersedia.',
          ],
        },
      ]}
    />
  );
}

export function CareersPage() {
  return (
    <InfoPage
      title="Karier di DtmX"
      subtitle="Bergabunglah dengan tim kecil yang membangun produk besar."
      updatedAt="Agustus 2026"
      sections={[
        {
          heading: 'Mengapa DtmX?',
          paragraphs: [
            'Kami tim yang ramping, fokus, dan penuh rasa ingin tahu. Setiap orang punya dampak langsung terhadap produk dan jutaan creator yang kami layani.',
          ],
        },
        {
          heading: 'Posisi Terbuka',
          list: [
            'Senior Frontend Engineer (React/TypeScript)',
            'Backend Engineer (Node.js/NestJS)',
            'Product Designer',
            'Growth Marketer',
          ],
        },
        {
          heading: 'Cara Melamar',
          paragraphs: [
            'Kirim CV dan portofolio melalui email ke careers@dtmx.app. Kami meninjau setiap lamaran dan akan menghubungi kandidat yang cocok dalam 2 minggu.',
          ],
        },
      ]}
    />
  );
}

export function DocsPage() {
  return (
    <InfoPage
      title="Dokumentasi API"
      subtitle="Semua endpoint yang kamu butuhkan untuk mengintegrasikan DtmX."
      updatedAt="Agustus 2026"
      sections={[
        {
          heading: 'Autentikasi',
          list: [
            'POST /api/auth/register — buat akun baru',
            'POST /api/auth/login — masuk dan dapatkan JWT',
            'GET /api/auth/google — login dengan Google',
            'GET /api/auth/facebook — login dengan Facebook',
            'POST /api/auth/refresh — perbarui access token',
          ],
        },
        {
          heading: 'Manajemen Konten',
          list: [
            'POST /api/posts — buat & jadwalkan posting',
            'GET /api/inbox — komentar dan DM terpusat',
            'POST /api/ai/reply — balasan AI',
            'POST /api/media/upload — unggah media',
          ],
        },
        {
          heading: 'Akun & Pembayaran',
          list: [
            'POST /api/social-accounts/connect — hubungkan akun sosial',
            'POST /api/subscriptions/activate — aktifkan langganan',
            'POST /api/payments/checkout — mulai pembayaran',
          ],
        },
        {
          heading: 'Autentikasi',
          paragraphs: [
            'Semua endpoint (kecuali yang berlabel publik) memerlukan header Authorization: Bearer <access_token>. Token kedaluwarsa dalam 15 menit dan dapat disegarkan dengan refresh token.',
          ],
        },
      ]}
    />
  );
}

export function ContactPage() {
  return (
    <InfoPage
      title="Hubungi Kami"
      subtitle="Punya pertanyaan atau butuh bantuan? Kami siap membantu."
      updatedAt="Agustus 2026"
      sections={[
        {
          heading: 'Dukungan Pelanggan',
          paragraphs: [
            'Tim kami merespons dalam waktu 1x24 jam pada hari kerja. Sertakan detail akun dan deskripsi masalah agar kami bisa membantu lebih cepat.',
          ],
          list: ['Email: support@dtmx.app', 'WhatsApp: +62 812-3456-7890', 'Jam operasional: Senin–Jumat, 09.00–18.00 WIB'],
        },
        {
          heading: 'Kolaborasi & Media',
          paragraphs: ['Untuk kerjasama brand dan media, hubungi: partnerships@dtmx.app'],
        },
      ]}
    />
  );
}

export function PrivacyPage() {
  return (
    <InfoPage
      title="Kebijakan Privasi"
      updatedAt="Agustus 2026"
      sections={[
        {
          heading: 'Data yang Kami Kumpulkan',
          paragraphs: [
            'Kami mengumpulkan data yang kamu berikan langsung (email, nama, username) serta data yang dibutuhkan untuk menyediakan layanan (akun sosial yang terhubung, konten yang kamu buat, dan catatan penggunaan kuota).',
          ],
        },
        {
          heading: 'Penggunaan Data',
          list: [
            'Menyediakan dan meningkatkan fitur DtmX.',
            'Memproses pembayaran langganan.',
            'Mengirim notifikasi terkait akun dan layanan.',
            'Meningkatkan keamanan dan mencegah penyalahgunaan.',
          ],
        },
        {
          heading: 'Berbagi Data',
          paragraphs: [
            'Kami tidak pernah menjual data kamu. Data hanya dibagikan kepada penyedia layanan yang diperlukan (misalnya gateway pembayaran) dengan komitmen keamanan yang setara.',
          ],
        },
        {
          heading: 'Hak Kamu',
          paragraphs: [
            'Kamu dapat meminta salinan, koreksi, atau penghapusan data melalui support@dtmx.app. Permintaan diproses maksimal 30 hari.',
          ],
        },
      ]}
    />
  );
}

export function TermsPage() {
  return (
    <InfoPage
      title="Syarat & Ketentuan"
      updatedAt="Agustus 2026"
      sections={[
        {
          heading: 'Layanan',
          paragraphs: [
            'DtmX menyediakan platform manajemen sosial media dengan fitur penjadwalan, publikasi, inbox, dan bantuan AI. Dengan menggunakan layanan ini, kamu menyetujui syarat yang tercantum di halaman ini.',
          ],
        },
        {
          heading: 'Akun',
          list: [
            'Kamu bertanggung jawab menjaga kerahasiaan kredensial akun.',
            'Satu akun diperbolehkan untuk satu pengguna atau satu tim sesuai paket.',
            'Penyalahgunaan yang melanggar hukum dapat berakibat pada penonaktifan akun.',
          ],
        },
        {
          heading: 'Pembayaran & Langganan',
          paragraphs: [
            'Langganan berbayar dapat dibatalkan kapan saja. Untuk paket dengan pembayaran manual, langganan aktif setelah bukti transfer dikonfirmasi admin. Pengembalian dana dipertimbangkan per kasus dalam 14 hari setelah pembelian.',
          ],
        },
        {
          heading: 'Batasan Tanggung Jawab',
          paragraphs: [
            'Layanan diberikan "sebagaimana adanya". DtmX tidak bertanggung jawab atas konten yang dipublikasikan pengguna atau kerugian tidak langsung yang timbul dari penggunaan layanan.',
          ],
        },
      ]}
    />
  );
}

export function SecurityPage() {
  return (
    <InfoPage
      title="Keamanan"
      updatedAt="Agustus 2026"
      sections={[
        {
          heading: 'Enkripsi',
          list: [
            'Semua lalu lintas dilindungi HTTPS (TLS).',
            'Password di-hash menggunakan bcrypt sebelum disimpan.',
            'Token akses platform dienkripsi dan tidak pernah ditampilkan dalam bentuk asli.',
          ],
        },
        {
          heading: 'Kontrol Akses',
          paragraphs: [
            'Autentikasi menggunakan JWT dengan masa berlaku singkat dan refresh token. Halaman admin dilindungi role khusus dan fitur diatur oleh guard di sisi server.',
          ],
        },
        {
          heading: 'Praktik Terbaik',
          list: [
            'Rotasi secret dan kunci API secara berkala.',
            'Pemantauan log keamanan dan notifikasi anomali.',
            'Backup database otomatis.',
            'Rincian kerentanan dilaporkan ke security@dtmx.app.',
          ],
        },
      ]}
    />
  );
}
