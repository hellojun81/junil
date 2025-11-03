import React, { useState } from "react";
import { Layout, Menu, Button, Typography } from "antd";
import { LogoutOutlined, HomeOutlined, SettingOutlined, UserOutlined, AppstoreOutlined } from "@ant-design/icons";
import styled from "styled-components";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Outlet } from "react-router-dom";

const { Content, Sider } = Layout;
const { Text } = Typography;

const AppLayout = ({ children, hideLogout = false }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    // client
    { key: "/", icon: <HomeOutlined />, label: "대시보드", isClient: true, isAdmin: false },
    { key: "/order", icon: <AppstoreOutlined />, label: "발주 입력", isClient: true, isAdmin: false },
    // admin
    { key: "/admin-orders", icon: <UserOutlined />, label: "발주서 관리(대시보드)", isClient: false, isAdmin: true },
    { key: "/settings", icon: <SettingOutlined />, label: "관리자 설정", isClient: false, isAdmin: true },
  ];

  const filtered = menuItems.filter(
    (i) => (user.loginKind === 0 && i.isClient) || (user.loginKind === 1 && i.isAdmin)
  );

  const items = [
    ...filtered.map((i) => ({ ...i, onClick: () => navigate(i.key) })),
    { key: "logout", icon: <LogoutOutlined />, label: "로그아웃", onClick: logout, style: { marginTop: "auto" } },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {user.loginKind === 1 && (
        <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
          <div
            style={{
              height: 32,
              margin: 16,
              background: "rgba(255,255,255,0.2)",
              color: "#fff",
              textAlign: "center",
              lineHeight: "32px",
            }}
          >
            {collapsed ? "A" : "관리자"}
          </div>
          <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={items} style={{ height: "100%" }} />
        </Sider>
      )}

      <Layout>
        <Content style={{ margin: 0 }}>
          {user.loginKind === 0 && !hideLogout && (
            <div style={{ position: "fixed", top: 16, right: 16, zIndex: 1000 }}>
              <Text strong style={{ marginRight: 10 }}>
                {user.name}님
              </Text>
              <Button icon={<LogoutOutlined />} onClick={logout} size="large" type="primary" />
            </div>
          )}
          {children}
             <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
