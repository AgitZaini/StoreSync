const WORDS = ["Apotek", "Sehat", "Mitra", "Tugas", "Absen", "Jadwal", "Stok", "Tim"];

/**
 * Kata sandi sementara yang mudah didiktekan (mis. "Sehat4821") dan memenuhi aturan server:
 * minimal 8 karakter, ada huruf dan angka. Pengguna wajib menggantinya saat login pertama.
 */
export function generateTemporaryPassword() {
  const random = new Uint32Array(2);
  crypto.getRandomValues(random);
  const word = WORDS[random[0] % WORDS.length];
  const digits = String(random[1] % 10000).padStart(4, "0");
  return `${word}${digits}`;
}
