/// <reference types="vite/client" />

/** SHA-256 hex digest of AUTH_PASSWORD, injected at build time by vite.config.ts. */
declare const __AUTH_PASSWORD_HASH__: string

/** True when DEVELOPMENT=true in .env: no splash screen, and the app starts signed in. */
declare const __DEVELOPMENT__: boolean

/** HOST_URL from .env without a trailing slash: base URL of the schedule API. Empty when unset. */
declare const __HOST_URL__: string
