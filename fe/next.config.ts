import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    return [
      { source: "/kenh-ban", destination: "/quan-tri", permanent: true },
      { source: "/kenh-ban/don-hang", destination: "/quan-tri/don-hang", permanent: true },
      { source: "/kenh-ban/don-hang/:path*", destination: "/quan-tri/don-hang", permanent: true },
      { source: "/kenh-ban/nhap-kho", destination: "/quan-tri/phieu-nhap", permanent: true },
      { source: "/kenh-ban/ton-kho", destination: "/quan-tri/ton-kho", permanent: true },
      { source: "/kenh-ban/kiem-ke", destination: "/quan-tri/kiem-ke", permanent: true },
      { source: "/kenh-ban/voucher", destination: "/quan-tri/khuyen-mai", permanent: true },
      { source: "/kenh-ban/bao-cao", destination: "/quan-tri/bao-cao", permanent: true },
      { source: "/kenh-ban/:path*", destination: "/quan-tri", permanent: true },
      { source: "/he-thong/phan-quyen", destination: "/quan-tri", permanent: true },
      { source: "/he-thong/phan-quyen/:path*", destination: "/quan-tri", permanent: true },
      { source: "/he-thong/sao-luu", destination: "/quan-tri", permanent: true },
      { source: "/he-thong/sao-luu/:path*", destination: "/quan-tri", permanent: true },
    ];
  },
};

export default nextConfig;
