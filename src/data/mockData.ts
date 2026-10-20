import type {
  ServiceItem,
  PointReward,
  BookingOrder,
  TimeSlot,
  User,
  AppNotification,
} from '../types/index.ts';

export const SINGLE_CATALOG: ServiceItem[] = [
  // =====================================================
  // KATEGORI 1: GRIYA AYU SPORT MASSAGE
  // =====================================================
  {
    id: 's1',
    name: 'Release Muscle (Perbaikan Otot - Full Body)',
    duration: '90 Menit',
    price: 400000,
    points: 20,
    tag: 'Sport Massage • Full Body',
    desc: 'Mengurangi pegal & kaku otot, melancarkan sirkulasi darah, meningkatkan fleksibilitas & membantu pemulihan setelah aktivitas berat / olahraga.',
    category: 'sport',
  },
  {
    id: 's2',
    name: 'Injury Muscle (Cidera Otot)',
    duration: 'Per Titik / Sesi',
    price: 250000,
    points: 15,
    tag: 'Sport Massage • Cidera Otot',
    desc: 'Mengurangi nyeri pada otot & sendi, mempercepat proses pemulihan, memperbaiki fungsi otot & meningkatkan mobilitas.',
    category: 'sport',
  },
  {
    id: 's3',
    name: 'Bekam',
    duration: '45 Menit',
    price: 150000,
    points: 10,
    tag: 'Sport Massage • Detoksifikasi',
    desc: 'Melancarkan peredaran darah, membantu detoksifikasi tubuh, mengurangi pegal, nyeri, masuk angin & membantu pemulihan otot.',
    category: 'sport',
  },
  {
    id: 's4',
    name: 'Dry Needle (Saraf Kejepit)',
    duration: 'Per Sesi',
    price: 250000,
    points: 15,
    tag: 'Sport Massage • Saraf Kejepit',
    desc: 'Meredakan nyeri akibat saraf kejepit, mengurangi ketegangan otot, melancarkan aliran darah & memperbaiki fungsi saraf & otot.',
    category: 'sport',
  },

  // =====================================================
  // KATEGORI 2: GRIYA AYU WILLNESS MASSAGE (KHUSUS WANITA)
  // =====================================================
  {
    id: 'w1',
    name: 'Willness Massage (60 Menit)',
    duration: '60 Menit',
    price: 150000,
    points: 10,
    tag: 'Khusus Wanita • 60 Menit',
    desc: 'Khusus Wanita: Relaksasi tubuh, melancarkan sirkulasi, mengurangi pegal dan meningkatkan kebugaran (Durasi 60 Menit).',
    category: 'wellness',
  },
  {
    id: 'w2',
    name: 'Willness Massage (90 Menit)',
    duration: '90 Menit',
    price: 220000,
    points: 12,
    tag: 'Khusus Wanita • 90 Menit',
    desc: 'Khusus Wanita: Relaksasi tubuh lebih menyeluruh, melancarkan sirkulasi, mengurangi pegal dan meningkatkan kebugaran (Durasi 90 Menit).',
    category: 'wellness',
  },
  {
    id: 'w3',
    name: 'Willness Massage (120 Menit)',
    duration: '120 Menit',
    price: 280000,
    points: 15,
    tag: 'Khusus Wanita • 120 Menit',
    desc: 'Khusus Wanita: Relaksasi tubuh ekstra lengkap, melancarkan sirkulasi, mengurangi pegal dan meningkatkan kebugaran (Durasi 120 Menit).',
    category: 'wellness',
  },
  {
    id: 'w4',
    name: 'Totok Wajah',
    duration: '30 - 45 Menit',
    price: 100000,
    points: 5,
    tag: 'Khusus Wanita • Segar & Rileks',
    desc: 'Khusus Wanita: Membantu melancarkan peredaran darah, membuat wajah lebih segar dan rileks.',
    category: 'wellness',
  },
  {
    id: 'w5',
    name: 'Lulur Badan',
    duration: '45 Menit',
    price: 150000,
    points: 10,
    tag: 'Khusus Wanita • Kulit Cerah',
    desc: 'Khusus Wanita: Mengangkat sel kulit mati, membuat kulit lebih bersih, halus dan cerah.',
    category: 'wellness',
  },
  {
    id: 'w6',
    name: 'Pijat Laktasi',
    duration: '60 Menit',
    price: 250000,
    points: 15,
    tag: 'Khusus Wanita • Ibu Menyusui',
    desc: 'Khusus Wanita: Membantu melancarkan produksi ASI dan mengurangi ketidaknyamanan pada payudara.',
    category: 'wellness',
  },
  {
    id: 'w7',
    name: 'Pijat Ibu Hamil',
    duration: '60 Menit',
    price: 250000,
    points: 15,
    tag: 'Khusus Wanita • Ibu Hamil',
    desc: 'Khusus Wanita: Membantu mengurangi pegal dan meningkatkan kenyamanan dalam masa kehamilan.',
    category: 'wellness',
  },
  {
    id: 'w8',
    name: 'Pijat Anak',
    duration: '45 Menit',
    price: 150000,
    points: 10,
    tag: 'Willness • Relaksasi Anak',
    desc: 'Pijat lembut untuk relaksasi, meningkatkan kualitas tidur dan tumbuh kembang anak.',
    category: 'wellness',
  },
  {
    id: 'w9',
    name: 'Hot Stone Massage',
    duration: '60 Menit',
    price: 250000,
    points: 15,
    tag: 'Khusus Wanita • Batu Hangat',
    desc: 'Khusus Wanita: Menggunakan batu hangat untuk relaksasi otot, melancarkan peredaran darah dan mengurangi stres.',
    category: 'wellness',
  },
  {
    id: 'w10',
    name: 'Limfatik Massage (Spesial Treatment)',
    duration: '90 Menit',
    price: 400000,
    points: 20,
    tag: '⭐ Spesial Treatment Wanita',
    desc: 'Khusus Wanita: Membantu melancarkan sistem limfatik, mengurangi pembengkakan, detoksifikasi tubuh dan meningkatkan daya tahan tubuh.',
    category: 'wellness',
  },
];

export const PACKAGE_CATALOG: ServiceItem[] = [
  {
    id: 'p1',
    name: 'Paket Recovery Sport (Release Muscle 90 Menit + Bekam)',
    duration: '135 Menit',
    price: 500000,
    normalPrice: 550000,
    points: 25,
    tag: 'Hemat Rp 50.000',
    desc: 'Kombinasi terbaik: Release Muscle Full Body (90 Menit) + Bekam untuk pemulihan & detoksifikasi tubuh maksimal.',
  },
  {
    id: 'p2',
    name: 'Paket Willness Cantik Wanita (Willness 90 Menit + Lulur + Totok)',
    duration: '150 Menit',
    price: 430000,
    normalPrice: 470000,
    points: 22,
    tag: 'Khusus Wanita • Hemat Rp 40.000',
    desc: 'Khusus Wanita: Relaksasi lengkap Willness Massage 90 Menit (Rp 220rb) + Lulur (Rp 150rb) + Totok Wajah (Rp 100rb).',
  },
  {
    id: 'p3',
    name: 'Paket Terapi Intensif (Injury Muscle + Dry Needle Saraf Kejepit)',
    duration: '90 Menit',
    price: 450000,
    normalPrice: 500000,
    points: 22,
    tag: 'Hemat Rp 50.000',
    desc: 'Penanganan fokus cidera otot & saraf kejepit untuk mengembalikan mobilitas dan bebas nyeri.',
  },
];

export const ANATOMY_LOCATIONS: string[] = [
  'Lutut (Knee)',
  'Pergelangan Kaki (Ankle)',
  'Telapak Kaki (Plantar)',
  'Pinggang / Saraf Kejepit (Low Back)',
  'Bahu (Shoulders)',
  'Leher (Neck)',
  'Otot Paha (Hamstring)',
  'Punggung Atas (Upper Back)',
  'Pergelangan Tangan (Wrist)',
];

// Sistem Poin Loyalitas Bertahap (Micro-Rewards) — Bukan untuk potongan harga uang tunai (cut: 0)
export const POINT_REWARDS: PointReward[] = [
  {
    id: 'none',
    label: 'Simpan Poin (Tabung Poin Loyalitas)',
    cost: 0,
    cut: 0,
  },
  {
    id: 'tier_30',
    label: '🍵 Tahap 1 (30 Poin): Gratis Wedang Rempah / Jahe Merah & Aromaterapi',
    cost: 30,
    cut: 0,
  },
  {
    id: 'tier_60',
    label: '💆‍♀️ Tahap 2 (60 Poin): Gratis Ekstra Durasi Pijat Kepala & Leher (+15 Menit)',
    cost: 60,
    cut: 0,
  },
  {
    id: 'tier_100',
    label: '🎁 Tahap 3 (100 Poin): Gratis Layanan Totok Wajah (30-45 Menit)',
    cost: 100,
    cut: 0,
  },
  {
    id: 'tier_150',
    label: '🎁 Tahap 4 (150 Poin): Gratis Layanan Bekam / Lulur Badan / Willness 60m',
    cost: 150,
    cut: 0,
  },
  {
    id: 'tier_250',
    label: '👑 Tahap 5 (250 Poin): Gratis Sesi Injury Muscle / Hot Stone / Willness 90m',
    cost: 250,
    cut: 0,
  },
];

export const INITIAL_TIME_SLOTS: TimeSlot[] = [
  { time: '09:00', active: true },
  { time: '11:00', active: true },
  { time: '13:00', active: true },
  { time: '15:00', active: true },
  { time: '17:00', active: true },
  { time: '19:00', active: true },
];

export const INITIAL_USERS: User[] = [];

export const INITIAL_BOOKINGS: BookingOrder[] = [];

export const PROMO_TEMPLATES = [
  {
    id: 'promo1',
    title: '💪 PRICE LIST BARU GRIYA AYU SPORT MASSAGE: Sehat, Aktif, Bebas Nyeri!',
    promoCode: 'GA-SPORT2026',
    imageUrl: '/assets/aistudio/image_2b8cf505.png',
    message:
      'Halo Member Setia Griya Ayu Sport Massage & Spa! 🌿✨\n\nKini hadir layanan lengkap *Griya Ayu Sport Massage*:\n• *Release Muscle (Full Body 90 Menit):* Rp 400.000 (+20 Poin)\n• *Injury Muscle (Cidera Otot / titik atau sesi):* Rp 250.000 (+15 Poin)\n• *Bekam:* Rp 150.000 (+10 Poin)\n• *Dry Needle (Saraf Kejepit):* Rp 250.000 (+15 Poin)\n\n📍 *Alamat Studio:* PERUMAHAN GRAHA CIPTA 5 BLOK E7 NO.3 (Bisa juga layanan Home Service + biaya perjalanan)\n🗺️ *Google Maps:* https://maps.app.goo.gl/CZY9eDC922v1byZQA\n\nYuk kunci jadwal terapi Anda sekarang di aplikasi Griya Ayu!',
  },
  {
    id: 'promo2',
    title: '🌸 PRICE LIST GRIYA AYU WILLNESS MASSAGE (Khusus Wanita): Sehat • Rileks • Seimbang!',
    promoCode: 'GA-WILLNESS',
    imageUrl: '/assets/aistudio/image_2d1f81d9.png',
    message:
      'Spesial untuk Pelanggan Wanita Griya Ayu! 💆‍♀️✨\n\nManjakan tubuh Anda dengan menu *Willness Massage (Khusus Wanita)*:\n• *Willness Massage:* 60m (Rp 150rb) | 90m (Rp 220rb) | 120m (Rp 280rb)\n• *Totok:* Rp 100.000 | *Lulur:* Rp 150.000\n• *Laktasi / Ibu Hamil / Hot Stone:* Rp 250.000\n• *Anak:* Rp 150.000\n• *Spesial Limfatik Massage:* Rp 400.000\n\n📍 *Alamat Studio:* PERUMAHAN GRAHA CIPTA 5 BLOK E7 NO.3 (Melayani juga Home Service + biaya perjalanan)\n🗺️ *Google Maps:* https://maps.app.goo.gl/CZY9eDC922v1byZQA',
  },
  {
    id: 'promo3',
    title: '👑 PROGRAM POIN LOYALITAS BERTAHAP (MICRO-REWARDS) GRIYA AYU!',
    promoCode: 'GA-LOYALTY',
    imageUrl: '/assets/aistudio/image_2b8cf505.png',
    message:
      'Makin rajin terapi di *Griya Ayu Sport Massage & Spa*, makin banyak hadiah ekstra layanan gratis! 🏆🌿\n\nKumpulkan poin setiap transaksi & tukarkan dengan Micro-Rewards Bertahap:\n• *30 Poin:* Gratis Wedang Rempah Jahe Merah & Aromaterapi\n• *60 Poin:* Gratis Ekstra Pijat Kepala & Leher (+15 Menit)\n• *100 Poin:* Gratis Layanan Totok Wajah\n• *150 Poin:* Gratis Layanan Bekam / Lulur / Willness 60m\n• *250 Poin:* Gratis Sesi Injury Muscle / Hot Stone\n\n📍 *Alamat Studio:* PERUMAHAN GRAHA CIPTA 5 BLOK E7 NO.3\n🗺️ *Google Maps:* https://maps.app.goo.gl/CZY9eDC922v1byZQA',
  },
];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [];

