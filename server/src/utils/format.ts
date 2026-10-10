const rupiahFormatter = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

/** Nominal rupiah untuk pesan notifikasi dan riwayat, mis. "Rp 125.000". */
export const formatRupiah = (value: { toString(): string } | number) => rupiahFormatter.format(Number(value.toString()));
