import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // exceljs is only used on the server (the export route); keep it out of the bundle.
  serverExternalPackages: ['exceljs'],
};

export default nextConfig;
