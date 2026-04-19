/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the Dev environment origins from the local loopback and WiFi IP address so CORS blocks don't kill auth fetches
  allowedDevOrigins: ['127.0.0.1', '192.168.1.6', 'localhost', '172.16.0.2'],
};

export default nextConfig;
