// src/pages/AdminRoute.jsx
import React, { Suspense } from "react";
import { Layout, Menu, Spin } from "antd";
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  AppstoreOutlined,
  TeamOutlined,
  BarChartOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Outlet, useLocation, Link, useNavigate } from "react-router-dom";

const { Header, Sider, Content } = Layout;

export default function AdminRoute() {
  const loc = useLocation();
  const selectedKey =
    loc.pathname.includes("/admin/orders") ? "orders" :
    loc.pathname.includes("/admin/items") ? "items" :
    loc.pathname.includes("/admin/customers") ? "customers" :
    loc.pathname.includes("/admin/stats") ? "stats" :
    loc.pathname.includes("/admin/settings") ? "settings" : "dashboard";

  const items = [
    { key: "dashboard", icon: <DashboardOutlined />, label: <Link to="/admin">대시보드</Link> },
    { key: "orders",    icon: <ShoppingCartOutlined />, label: <Link to="/admin/orders">주문관리</Link> },
    { key: "items",     icon: <AppstoreOutlined />,    label: <Link to="/admin/items">상품관리</Link> },
    { key: "customers", icon: <TeamOutlined />,        label: <Link to="/admin/customers">고객관리</Link> },
    { key: "stats",     icon: <BarChartOutlined />,    label: <Link to="/admin/stats">통계</Link> },
    { key: "settings",  icon: <SettingOutlined />,     label: <Link to="/admin/settings">환경설정</Link> },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider breakpoint="lg" collapsedWidth={64}>
        <div style={{ color: "#fff", padding: 16, fontWeight: 700 }}>관리자</div>
        <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={items} />
      </Sider>
      <Layout>
        <Header style={{ background: "#fff", padding: "0 16px", fontWeight: 600 }}>전일축산 관리자</Header>
        <Content style={{ margin: 16 }}>
          <Suspense fallback={<Spin />}>
            <Outlet />
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  );
}
