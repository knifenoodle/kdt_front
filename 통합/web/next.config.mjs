/** @type {import('next').NextConfig} */
export default {
  // BFF 가 같은 오리진에서 API 를 서브하도록 프록시한다 → CORS 항목(M1)이 소멸한다.
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://127.0.0.1:8100/api/:path*' }];
  },
};
