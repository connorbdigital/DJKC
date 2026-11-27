/// <reference types="vite/client" />

/** The one flag main.tsx reads: a production build is the only place a service worker belongs. */
interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injected by vite.config.ts at build time. */
declare const __BUILD_TIME__: string;
