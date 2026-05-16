'use client'

// Bundle Sandpack's runtime client with the preview chunk. Without this, Next.js
// lazy-loads clients/runtime as a separate async chunk that often 404s in dev.
import '@codesandbox/sandpack-client/clients/runtime'
