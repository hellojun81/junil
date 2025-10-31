import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 5174 포트를 명시적으로 설정
    port: 5174,
    // 외부 IP 주소 및 네트워크에서 접속 가능하도록 설정
    host: true,
  },
});
