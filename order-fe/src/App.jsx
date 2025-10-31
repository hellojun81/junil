// src/App.jsx
import React, { useEffect, useState, Suspense, lazy } from "react";
import { ConfigProvider, Layout, Spin, Typography, notification,App as AntdApp } from "antd";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthContext } from "./context/AuthContext";
import AppLayout from "./components/AppLayout";
import Login from "./components/LoginForm";
import HomeRoute from "./pages/HomeRoute";
import AdminDashboard from "./pages/AdminDashboard";
import ClientDashboard from "./pages/ClientDashboard";
import CartProvider from "./context/CartContext";
import AdminRoute from "./pages/AdminRoute";
import OrdersStats from "./pages/OrderStats";
import ItemsManager from "./pages/ItemsManager";
import CustomersManager from "./pages/CustomersManager";
import AdminSettings from "./pages/AdminSettings";
import OrdersManager from "./pages/OrdersManager";

const SettingsRoute = lazy(() => import("./pages/SettingsRoute"));
const { Text } = Typography;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("junil_user");
    if (stored) setUser(JSON.parse(stored));
    setLoading(false);
  }, []);

  const onLoginSuccess = (u) => setUser(u);
  const logout = () => {
    setUser(null);
    localStorage.removeItem("junil_user");
    notification.info({ message: "로그아웃 되었습니다.", duration: 2 });
  };

  if (loading) {
    return (
      <Layout style={{ minHeight: "100vh", justifyContent: "center", alignItems: "center" }}>
        <Spin size="large" />
        <Text style={{ marginTop: 16 }}>로그인 정보 확인 중...</Text>
      </Layout>
    );
  }

  if (!user) {
    return (
      <ConfigProvider theme={{ token: { colorPrimary: "#3F8600" } }}>
        <Login onLoginSuccess={onLoginSuccess} />
      </ConfigProvider>
    );
  }

  const isAdmin = user.login_Kind === "ADMIN"; // ← 숫자(1/0)라면 user.login_Kind === 1 로 바꿔주세요.
  const isCustomer = user.login_Kind === "CUSTOMER"; // ← 숫자(1/0)라면 0 비교

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#3F8600" } }}>
      <AntdApp> 
      <AuthContext.Provider value={{ user, logout }}>
        <CartProvider user={user}>
          <BrowserRouter>
            <Suspense fallback={<Spin tip="로딩 중..." />}>
              <Routes>
                {/* ===== 관리자 스택 (사이드바/헤더는 AdminRoute 안에서 렌더) ===== */}
                {isAdmin && (
                  <>
                    <Route path="/admin" element={<AdminRoute />}>
                      <Route index element={<AdminDashboard />} />
                      <Route path="orders" element={<OrdersManager />} />
                      <Route path="items" element={<ItemsManager />} />
                      <Route path="customers" element={<CustomersManager />} />
                      <Route path="stats" element={<OrdersStats />} />
                      <Route path="settings" element={<AdminSettings />} />
                    </Route>
                    {/* 관리자 기본 진입은 /admin */}
                    <Route path="/" element={<Navigate to="/admin" replace />} />
                    <Route path="*" element={<Navigate to="/admin" replace />} />
                  </>
                )}

                {/* ===== 클라이언트 스택(AppLayout 사용) ===== */}
                {isCustomer && (
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<ClientDashboard user={user} />} />
                    <Route path="/order" element={<HomeRoute />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                )}
              </Routes>
            </Suspense>
          </BrowserRouter>
        </CartProvider>
      </AuthContext.Provider>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
