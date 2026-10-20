import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOrderPricing,
  isDateHoliday,
  isSlotAvailable,
  applyPointsCompletion,
  formatRupiah,
  formatCountdown,
  getPaymentMethodDetails,
  buildAdminWaConfirmationMessage,
} from './spaLogic.ts';
import type { ServiceItem, PointReward, TimeSlot, BookingOrder } from '../types/index.ts';

const MOCK_SINGLE: ServiceItem[] = [
  { id: 's1', name: 'Sport Massage', duration: '90 Menit', price: 400000, points: 20, tag: '', desc: '' },
  { id: 's2', name: 'Injury Treatment', duration: '60 Menit', price: 250000, points: 15, tag: '', desc: '' },
];

const MOCK_PACKAGES: ServiceItem[] = [
  { id: 'p1', name: 'Paket Recovery Total', duration: '135 Menit', price: 500000, points: 25, tag: '', desc: '' },
];

const MOCK_REWARDS: PointReward[] = [
  { id: 'none', label: 'Tanpa Tukar Poin', cost: 0, cut: 0 },
  { id: 'tier_30', label: 'Gratis Wedang Rempah', cost: 30, cut: 0 },
  { id: 'tier_100', label: 'Gratis Totok Wajah', cost: 100, cut: 0 },
];

test('formatRupiah formats numbers accurately', () => {
  const res = formatRupiah(400000);
  assert.ok(res.includes('400.000'));
});

test('formatCountdown formats 20-minute milliseconds into MM:SS', () => {
  assert.equal(formatCountdown(20 * 60 * 1000), '20:00');
  assert.equal(formatCountdown(65 * 1000), '01:05');
  assert.equal(formatCountdown(0), '00:00');
  assert.equal(formatCountdown(-5000), '00:00');
});

test('getPaymentMethodDetails returns QRIS or Virtual Account details', () => {
  const qris = getPaymentMethodDetails('qris', '081288997766');
  assert.equal(qris.isQris, true);
  assert.equal(qris.vaNumber, 'ID1026578139051');

  const bca = getPaymentMethodDetails('va_bca', '081288997766');
  assert.equal(bca.isQris, false);
  assert.ok(bca.vaNumber.startsWith('8801'));
});

test('calculateOrderPricing calculates single services and attaches Micro-Reward without discounting price', () => {
  const res = calculateOrderPricing(
    'single',
    ['s1', 's2'],
    'p1',
    MOCK_SINGLE,
    MOCK_PACKAGES,
    'tier_30',
    MOCK_REWARDS,
    65,
    'Lutut (Knee)'
  );
  assert.equal(res.subtotal, 650000);
  assert.equal(res.discountAmount, 0);
  assert.equal(res.finalPrice, 650000);
  assert.equal(res.pts, 35);
  assert.ok(res.titleStr.includes('Lutut (Knee)'));
  assert.ok(res.titleStr.includes('Bonus Tukar 30 Poin'));
});

test('isDateHoliday identifies routine closed weekdays and custom dates', () => {
  assert.equal(isDateHoliday('2026-10-25', 0, [0], ['2026-10-22']), true);
  assert.equal(isDateHoliday('2026-10-22', 4, [0], ['2026-10-22']), true);
  assert.equal(isDateHoliday('2026-10-20', 2, [0], ['2026-10-22']), false);
});

test('isSlotAvailable only locks slot when paymentStatus is Berhasil (not Pending)', () => {
  const masterSlots: TimeSlot[] = [
    { time: '09:00', active: true },
    { time: '11:00', active: true },
    { time: '17:00', active: false },
  ];

  const bookings: BookingOrder[] = [
    {
      id: 1,
      customer: 'Budi',
      wa: '08111',
      items: 'Sport Massage',
      date: '2026-10-20',
      datePretty: 'Sel, 20 Okt 2026',
      time: '09:00',
      total: 400000,
      ptsEarned: 40,
      payMethod: 'QRIS',
      payMethodType: 'qris',
      paymentStatus: 'Pending',
      expiresAt: Date.now() + 1200000,
      status: 'Pending_Payment',
      createdAt: 'now',
    },
    {
      id: 2,
      customer: 'Siti',
      wa: '08222',
      items: 'Sport Massage',
      date: '2026-10-20',
      datePretty: 'Sel, 20 Okt 2026',
      time: '11:00',
      total: 400000,
      ptsEarned: 40,
      payMethod: 'BCA Virtual Account',
      payMethodType: 'va_bca',
      paymentStatus: 'Berhasil',
      expiresAt: Date.now() + 1200000,
      status: 'Paid',
      createdAt: 'now',
    },
  ];

  // 09:00 has only a Pending booking, so it must still be available for competition
  const slot09 = isSlotAvailable('09:00', '2026-10-20', masterSlots, bookings);
  assert.equal(slot09.available, true);
  assert.equal(slot09.reason, 'available');

  // 11:00 has a Berhasil (Paid) booking, so it must be locked (booked)
  const slot11 = isSlotAvailable('11:00', '2026-10-20', masterSlots, bookings);
  assert.equal(slot11.available, false);
  assert.equal(slot11.reason, 'booked');

  // 17:00 is closed by Admin
  const slot17 = isSlotAvailable('17:00', '2026-10-20', masterSlots, bookings);
  assert.equal(slot17.available, false);
  assert.equal(slot17.reason, 'closed');
});

test('buildAdminWaConfirmationMessage generates WhatsApp URL and friendly confirmation copy', () => {
  const order: BookingOrder = {
    id: 123456,
    customer: 'Kak Nadia',
    wa: '081288997766',
    items: 'Sport Massage & Umum',
    date: '2026-10-20',
    datePretty: 'Sel, 20 Okt 2026',
    time: '09:00',
    total: 400000,
    ptsEarned: 40,
    payMethod: 'QRIS Otomatis',
    payMethodType: 'qris',
    paymentStatus: 'Berhasil',
    expiresAt: Date.now(),
    status: 'Paid',
    createdAt: '19 Okt 2026',
  };
  const msg = buildAdminWaConfirmationMessage(order);
  assert.ok(msg.text.includes('Kak Nadia'));
  assert.ok(msg.text.includes('Admin Rismawati'));
  assert.ok(msg.text.includes('PERUMAHAN GRAHA CIPTA 5 BLOK E7 NO.3'));
  assert.ok(msg.text.includes('https://maps.app.goo.gl/CZY9eDC922v1byZQA'));
  assert.ok(msg.url.startsWith('https://wa.me/6281288997766?text='));
});

test('applyPointsCompletion increments customer points', () => {
  const u = { name: 'Nadia', phone: '0812', pass: '123456', points: 100 };
  const updated = applyPointsCompletion(u, 40);
  assert.equal(updated.points, 140);
});
