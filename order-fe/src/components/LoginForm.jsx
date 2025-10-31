// LoginForm.jsx
import React, { useState } from "react";
import { Layout, Card, Typography, Button, Space, Divider,notification } from "antd";
import { LoginOutlined } from "@ant-design/icons";
import PhoneNumberInput from "./PhoneNumberInput";
import { loginByPhone } from "../services/auth"; // ← 경로 오타 수정!
import { saveUser } from "../utils/storage";

const { Content } = Layout;
const { Title, Text } = Typography;

const LoginForm = ({ onLoginSuccess }) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phoneNumber) {
      // antd notification은 여기보다 상위(App)에서 ConfigProvider로 theme 적용되면 색상이 맞게 나옵니다.
      // 간단히 경고는 버튼 비활성화/폼 밸리데이션으로도 대체 가능.
      // 여기선 기존 로직 유지
      // eslint-disable-next-line no-undef
      notification?.warning?.({ message: "전화번호를 입력해주세요." });
      return;
    }

    setLoading(true);
    const result = await loginByPhone(phoneNumber);
    setLoading(false);

    if (result.success) {
      saveUser(result.user);
      onLoginSuccess(result.user);
      // eslint-disable-next-line no-undef
      notification?.success?.({ message: `${result.user.name}님, 로그인 성공!`, duration: 2 });
    } else {
      // eslint-disable-next-line no-undef
      notification?.error?.({
        message: "로그인 실패",
        description: result.message || "등록되지 않은 전화번호이거나 서버 오류입니다.",
      });
    }
  };

  return (
    <Layout style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f6f9fc 0%, #eef3f7 100%)" }}>
      <Content
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Card
          bordered={false}
          style={{
            width: "100%",
            maxWidth: 420,
            borderRadius: 16,
            boxShadow: "0 12px 32px rgba(0,0,0,0.08)",
          }}
          bodyStyle={{ padding: 28 }}
        >
          <Space direction="vertical" size={8} style={{ width: "100%", textAlign: "center" }}>
            {/* 로고/브랜드 영역 (필요 시 이미지로 교체 가능) */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                margin: "0 auto",
                background: "#3F8600",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 800,
                letterSpacing: 1,
              }}
            >
              JUN
            </div>
            <Title level={3} style={{ margin: 0 }}>
              전일축산 발주 시스템
            </Title>
            <Text type="secondary">등록된 전화번호로 간편 로그인</Text>
          </Space>

          <Divider style={{ margin: "18px 0" }} />

          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <PhoneNumberInput value={phoneNumber} onChange={setPhoneNumber} onEnter={handleLogin} />

            <Button
              type="primary"
              size="large"
              onClick={handleLogin}
              loading={loading}
              block
              icon={<LoginOutlined />}
            >
              로그인
            </Button>
          </Space>

          {/* 하단 안내 */}
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              전화번호는 하이픈(-) 없이 입력해 주세요.
            </Text>
          </div>
        </Card>
      </Content>
    </Layout>
  );
};

export default LoginForm;
