import React from "react";
import { Typography } from "antd";

const { Title, Text } = Typography;

const SettingsRoute = () => (
  <div style={{ padding: 24 }}>
    <Title level={3}>관리자 설정</Title>
    <Text>각종 시스템 설정 기능이 여기에 들어갑니다.</Text>
  </div>
);

export default SettingsRoute;
