const KEY = "studio-github-token";

/** The token lives in sessionStorage only: closing the tab ends the session. */
export const getToken = (): string => {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

export const setToken = (token: string) => {
  try {
    sessionStorage.setItem(KEY, token.trim());
  } catch {
    /* private mode: keep it in memory only */
  }
};

export const clearToken = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
};
