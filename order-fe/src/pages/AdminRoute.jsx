// src/pages/AdminRoute.jsx
import React, { Suspense, useContext } from "react";
import { Layout, Menu, Spin, Button, Popconfirm } from "antd";
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  AppstoreOutlined,
  TeamOutlined,
  BarChartOutlined,
  SettingOutlined,
  LogoutOutlined
} from "@ant-design/icons";
import { Outlet, useLocation, Link } from "react-router-dom";
import { CompanyName } from "../api/DefaultSetting";
import { AuthContext } from "../context/AuthContext"; // ✅ 추가

const { Header, Sider, Content } = Layout;
export default function AdminRoute() {
  const { companyName, loading } = CompanyName();
  const { logout } = useContext(AuthContext); // ✅ 컨텍스트에서 가져오기


  const loc = useLocation();
  // const navigate = useNavigate();
  const selectedKey =
    loc.pathname.includes("/admin/orders") ? "orders" :
      loc.pathname.includes("/admin/items") ? "items" :
        loc.pathname.includes("/admin/customers") ? "customers" :
          loc.pathname.includes("/admin/stats") ? "stats" :
            loc.pathname.includes("/admin/settings") ? "settings" : "dashboard";

  const items = [
    { key: "dashboard", icon: <DashboardOutlined />, label: <Link to="/admin">대시보드</Link> },
    { key: "orders", icon: <ShoppingCartOutlined />, label: <Link to="/admin/orders">주문관리</Link> },
    { key: "items", icon: <AppstoreOutlined />, label: <Link to="/admin/items">상품관리</Link> },
    { key: "customers", icon: <TeamOutlined />, label: <Link to="/admin/customers">고객관리</Link> },
    { key: "stats", icon: <BarChartOutlined />, label: <Link to="/admin/stats">통계</Link> },
    { key: "settings", icon: <SettingOutlined />, label: <Link to="/admin/settings">환경설정</Link> },
  ];
  const handleLogout = () => {
    // localStorage.removeItem("junil_user");
    logout();

  };
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider breakpoint="lg" collapsedWidth={64}>
        <div style={{ color: "#fff", padding: 16, fontWeight: 700 }}>관리자</div>
        <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={items} />
      </Sider>

      <Layout>
        <Header
          style={{
            background: "#fff",
            padding: "0 16px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>
            {console.log('CompanyName', companyName)}
            {`${companyName} 관리자`}
          </span>

          <Popconfirm
            title="로그아웃"
            description="정말 로그아웃하시겠습니까?"
            okText="로그아웃"
            cancelText="취소"
            onConfirm={handleLogout}
          >
            <Button
              type="text"
              icon={<LogoutOutlined />}
              style={{ color: "#000", fontWeight: 500 }}
            >
              로그아웃
            </Button>
          </Popconfirm>
        </Header>



        <Content style={{ margin: 16 }}>
          <Suspense fallback={<Spin />}>
            <Outlet />
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  );
}
