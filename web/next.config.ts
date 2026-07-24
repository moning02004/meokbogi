import type {NextConfig} from "next";

const nextConfig: NextConfig = {
    output: 'standalone',
    allowedDevOrigins: ["192.168.0.4"]
}
export default nextConfig;
