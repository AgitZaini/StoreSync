const ACCESS_TOKEN_KEY = "storesync.accessToken";
const REFRESH_TOKEN_KEY = "storesync.refreshToken";
const LAST_ACTIVITY_KEY = "storesync.lastActivityAt";

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string | null) => {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Mode privat atau storage diblokir: sesi tetap berjalan selama tab terbuka.
  }
};

export const authStorage = {
  getAccessToken: () => read(ACCESS_TOKEN_KEY),
  getRefreshToken: () => read(REFRESH_TOKEN_KEY),
  setTokens: (accessToken: string, refreshToken: string) => {
    write(ACCESS_TOKEN_KEY, accessToken);
    write(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear: () => {
    write(ACCESS_TOKEN_KEY, null);
    write(REFRESH_TOKEN_KEY, null);
    write(LAST_ACTIVITY_KEY, null);
  },
  /** Dibagi antar-tab supaya tab yang diam tidak mengeluarkan tab lain yang aktif. */
  getLastActivityAt: () => Number(read(LAST_ACTIVITY_KEY)) || null,
  setLastActivityAt: (timestamp: number) => write(LAST_ACTIVITY_KEY, String(timestamp)),
};
