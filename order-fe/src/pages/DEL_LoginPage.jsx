import React from "react";
import { Layout, Card, Typography } from "antd";
import LoginForm from "../components/LoginForm";
import { CompanyName } from "../api/DefaultSetting"; // ✅ 추가
const { Content } = Layout;
const { Title, Text } = Typography;

const containerStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f5f5f5",
  padding: 16,
};

const cardStyle = {
  width: 420,
  maxWidth: "92vw",
  borderRadius: 16,
};

const LoginPage = () => {
  const { companyName, loading } = CompanyName();
  const navigate = useNavigate();
  const handleLoginSuccess = (user) => {
    // 사용자 정보 localStorage에 저장 (이미 saveUser()에서 저장됨)
    console.log("로그인 성공:", user);

    // 로그인 유형에 따라 분기
    if (user.login_Kind === 'ADMIN') {
      navigate("/admin/dashboard"); // 관리자 화면으로 이동
    } else {
      navigate("/orders"); // 일반 사용자 주문 화면으로 이동
    }
  };

  return (
    <Content
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f5f5",
        padding: 16,
      }}
    >
      <Card style={{ width: 420, maxWidth: "92vw", borderRadius: 16 }}>
        <Title level={2} style={{ color: "#3F8600", marginBottom: 8 }}>
      
              {`${companyName} 발주 시스템`}
        </Title>
        <Text type="secondary" style={{ marginBottom: 24, display: "block" }}>
          등록된 전화번호를 입력하여 로그인해주세요.
        </Text>
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      </Card>
    </Content>
  );
};

export default LoginPage;
