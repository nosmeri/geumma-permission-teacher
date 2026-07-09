import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '전북과학고 전자허가원 (교사용)',
    short_name: '전북과고허가원 교사용',
    description: '전북과학고등학교 전자허가원 교사 승인 및 관리 시스템',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
