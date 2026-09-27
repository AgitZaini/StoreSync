/**
 * Menyeragamkan nomor HP Indonesia ke format 62xxxxxxxxxx.
 * Menerima 08xx, 8xx, 628xx, dan +62 8xx beserta spasi atau tanda hubung.
 * Mengembalikan null bila hasilnya bukan nomor yang masuk akal.
 */
export const normalizePhone = (input: string) => {
  let digits = input.replace(/\D/g, "");

  if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (digits.startsWith("8")) {
    digits = `62${digits}`;
  }

  if (!/^62\d{8,13}$/.test(digits)) {
    return null;
  }

  return digits;
};
