export type Language = 'id' | 'en';

export interface User {
  id?: string;
  name: string;
  phone: string;
  pass: string;
  points: number;
  role?: 'customer' | 'member' | 'admin';
  status?: 'active' | 'inactive';
  avatar?: string;
}

export type ServiceGridCategory =
  | 'kebugaran'
  | 'otot_cedera'
  | 'spa_tubuh'
  | 'bekam'
  | 'khusus_wanita';

export interface ServiceItem {
  id: string;
  name: string;
  duration: string;
  price: number;
  points: number;
  tag: string;
  desc: string;
  normalPrice?: number;
  category?: 'sport' | 'wellness';
  gender?: 'all' | 'male' | 'female';
  genderBadge?: string;
  gridCategories?: ServiceGridCategory[];
  available?: boolean;
  hasInjurySpots?: boolean;
}

export interface PointReward {
  id: string;
  title?: string;
  label: string;
  cost: number;
  cut: number;
  description?: string;
  available?: boolean;
  stockInfo?: string;
}

export type PaymentMethodType =
  | 'qris'
  | 'bank_transfer'
  | 'cash'
  | 'va_bca'
  | 'va_mandiri'
  | 'va_bri'
  | 'va_bni';

export interface RefundRequestInfo {
  reason: string;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  proofImage?: string;
  requestedAt: string;
  isCashCancellation?: boolean;
  processedAt?: string;
}

export interface BookingOrder {
  id: number;
  transactionNumber?: string; // e.g. "#GA-363858"
  customer: string;
  wa: string;
  items: string;
  date: string; // YYYY-MM-DD
  datePretty: string;
  time: string; // e.g. "09:00"
  total: number;
  ptsEarned: number;
  ptsRedeemedCost?: number;
  payMethod: string;
  payMethodType: PaymentMethodType;
  vaNumber?: string;
  paymentStatus:
    | 'Pending'
    | 'Lunas'
    | 'Berhasil'
    | 'Menunggu Verifikasi Admin'
    | 'Booking Cash (Bayar di Lokasi)'
    | 'Terkonfirmasi (ACC Admin)'
    | 'Gagal'
    | 'Kedaluwarsa'
    | 'Dibatalkan'
    | 'Dibatalkan (Waktu Habis / Kedaluwarsa)'
    | 'Menunggu Cek Refund Admin'
    | 'Refund Selesai / Dibatalkan';
  expiresAt: number; // epoch ms (createdAt + 20 minutes)
  status:
    | 'Pending_Payment'
    | 'Paid'
    | 'Verified'
    | 'Completed'
    | 'Cancelled'
    | 'Refund_Requested'
    | 'Refund_Completed';
  createdAt: string;
  therapist?: string;
  verifiedDateIso?: string;
  paymentProofImage?: string;
  paymentChannel?: string;
  healthNote?: string;
  rescheduledAt?: string;
  previousSchedule?: string;
  refundRequest?: RefundRequestInfo;
  refundRejectedReason?: string;
}

export interface AppNotification {
  id: number;
  target: 'admin' | 'customer' | 'all_customers';
  targetPhone?: string; // specific customer phone if target === 'customer'
  type:
    | 'payment_success'
    | 'payment_pending'
    | 'admin_confirmed'
    | 'promo_broadcast'
    | 'points_reward'
    | 'refund_requested'
    | 'refund_approved'
    | 'refund_rejected'
    | 'booking_rescheduled';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  // Optional metadata for Admin WA confirmation or Promo Broadcast
  orderId?: number;
  customerName?: string;
  customerWa?: string;
  waConfirmationUrl?: string;
  waConfirmationText?: string;
  promoImage?: string;
  promoCode?: string;
}

export interface PromoCampaign {
  id: number;
  title: string;
  message: string;
  imageUrl: string;
  promoCode: string;
  createdAt: string;
  sentCount: number;
}

export interface TimeSlot {
  time: string;
  active: boolean;
}

export interface HomeServiceDaySchedule {
  dayOfWeek: number; // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  dayName: string;
  isOpen: boolean;
  openTime: string; // HH:mm e.g. "09:00"
  closeTime: string; // HH:mm e.g. "20:00"
}

export interface HomeServiceScheduleConfig {
  enabled: boolean;
  days: HomeServiceDaySchedule[];
  slots: TimeSlot[];
  updatedAt?: string;
}

