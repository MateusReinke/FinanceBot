import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Default is 1MB; receipt photo uploads (src/app/actions/events.ts,
    // extractReceiptExpenses) routinely exceed that. Keep in sync with
    // MAX_RECEIPT_BYTES in src/lib/validation/events.ts, with headroom for
    // multipart/form-data framing overhead.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
