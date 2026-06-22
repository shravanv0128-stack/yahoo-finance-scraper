/** @type {import('next').NextConfig} */

// Security headers applied to every response. Kept conservative so they add
// real protection (clickjacking, MIME sniffing, referrer/permission leakage,
// forced HTTPS) without risking breakage of the Next.js + Supabase + Google
// auth flows. We deliberately avoid a strict script/style CSP here because
// Next's runtime relies on inline bootstrap scripts; `frame-ancestors 'none'`
// still fully blocks clickjacking, mirroring X-Frame-Options.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
