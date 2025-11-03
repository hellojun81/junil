// src/App.jsx
import React, { useEffect, useState, Suspense, lazy } from "react";
import { ConfigProvider, Layout, Spin, Typography, App as AntdApp } from "antd";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthContext } from "./context/AuthContext";
import AppLayout from "./components/AppLayout";
import Login from "./components/LoginForm";
import HomeRoute from "./pages/HomeRoute";
import AdminDashboard from "./pages/AdminDashboard";
import ClientDashboard from "./pages/ClientDashboard";
import CartProvider from "./context/CartContext";
import AdminRoute from "./pages/AdminRoute";
import OrdersStats from "./pages/OrdersStats";
import ItemsManager from "./pages/ItemsManager";
import CustomersManager from "./pages/CustomersManager";
import AdminSettings from "./pages/AdminSettings";
import OrdersManager from "./pages/OrdersManager";

const SettingsRoute = lazy(() => import("./pages/SettingsRoute"));
const { Text } = Typography;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { notification, message, modal } = AntdApp.useApp();

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
        <AntdApp>
          <Login onLoginSuccess={onLoginSuccess} />
        </AntdApp>
      </ConfigProvider>
    );
  }

  const kind = String(user?.login_Kind ?? "").toUpperCase();
  const isAdmin = kind === "ADMIN" || kind === "1";
  const isCustomer = kind === "CUSTOMER" || kind === "0";

  console.log(user.login_Kind)
  return (
     <ConfigProvider theme={{ token: { colorPrimary: "#3F8600" } }}>
      <AntdApp>
        <AuthContext.Provider value={{ user, logout }}>
          <CartProvider user={user}>
            <BrowserRouter>
              <Suspense fallback={<Spin tip="로딩 중..." />}>
              {console.log({ kind, isCustomer, isAdmin, path: window.location.pathname })}
                <Routes>
  {/* 1) 관리자 전용: /admin/* 에 항상 라우트는 존재.
        단, 고객이 접근하면 즉시 "/"로 리다이렉트 */}
  <Route
    path="/admin/*"
    element={isAdmin ? <AdminRoute /> : <Navigate to="/" replace />}
  >
    {isAdmin && (
      <>
        <Route index element={<AdminDashboard />} />
        <Route path="orders" element={<OrdersManager />} />
        <Route path="items" element={<ItemsManager />} />
        <Route path="customers" element={<CustomersManager />} />
        <Route path="stats" element={<OrdersStats />} />
        <Route path="settings" element={<AdminSettings />} />
      </>
    )}
  </Route>

  {/* 2) 고객 영역: "/*"를 고객 레이아웃으로 감싸고 기본은 "/" */}
  <Route
    path="/*"
    element={isCustomer ? <AppLayout /> : <Navigate to="/admin" replace />}
  >
    {isCustomer && (
      <>
        <Route index element={<ClientDashboard user={user} />} />
        <Route index element={<HomeRoute/>} />
        {/* 고객용 추가 라우트가 있으면 여기에 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </>
    )}
  </Route>
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
