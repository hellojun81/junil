// components/TodayCart.jsx
import React, { useMemo } from "react";
import {
  Card,
  List,
  Typography,
  Tag,
  Button,
  Popconfirm,
  message,
  Space,
  InputNumber,
  Select,
} from "antd";
import { useCart } from "../context/CartContext";

const { Text, Title } = Typography;

function isToday(dateStr) {
  const now = new Date();
  const d = new Date(dateStr || now);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function TodayCartSummary() {
  const { cart, clear, removeItem, updateItem } = useCart(); // ✅ updateItem 추가

  const todayItems = useMemo(
    () => cart.filter((it) => !it.createdAt || isToday(it.createdAt)),
    [cart]
  );

  const handleRemove = (item) => {
    removeItem(item.id);
    message.info(`'${item.label}' 항목을 삭제했습니다.`);
  };

  const handleChange = (id, field, value) => {
    updateItem(id, { [field]: value });
  };

  const unitOptions = [
    { label: "KG", value: "KG" },
    { label: "BOX", value: "BOX" },
    { label: "EA", value: "EA" },
  ];

  return (
    <Card
      style={{ margin: "16px 0" }}
      title="오늘 장바구니 현황"
      extra={
        <Popconfirm
          title="장바구니를 모두 비울까요?"
          okText="비우기"
          cancelText="취소"
          onConfirm={() => {
            localStorage.removeItem("temp_cart");
            clear();
            message.success("장바구니를 모두 비웠습니다.");
          }}
        >
          <Button danger size="small">
            전체 비우기
          </Button>
        </Popconfirm>
      }
    >
      <Title level={4} style={{ marginBottom: 12 }}>
        총 {todayItems.length}건
      </Title>
      <List
        dataSource={todayItems}
        locale={{ emptyText: <Text type="secondary">오늘 담은 항목이 없습니다.</Text> }}
        renderItem={(it) => (
          <List.Item
            actions={[
              <Popconfirm
                key="remove"
                title="이 항목을 삭제할까요?"
                okText="삭제"
                cancelText="취소"
                onConfirm={() => handleRemove(it)}
              >
                <Button size="small" danger>
                  삭제
                </Button>
              </Popconfirm>,
            ]}
          >
                 {/* {console.log('subItem',it.subItem)} */}
            <List.Item.Meta
              title={
                <Space>
                  <Tag color={it.type === "돼지" ? "magenta" : "geekblue"}>{it.type} </Tag>
                  <Text strong>
                    {it.label}
               
                    {it.subItem ? ` (${it.subItem})` : ""}
                  </Text>
                </Space>
              }
              description={
                <Space wrap>
                  <InputNumber
                    min={0.1}
                    step={0.1}
                    value={it.quantity}
                    onChange={(v) => handleChange(it.id, "quantity", v)}
                    style={{ width: 80 }}
                  />
                  <Select
                    value={it.unit}
                    onChange={(v) => handleChange(it.id, "unit", v)}
                    options={unitOptions}
                    style={{ width: 90 }}
                  />
                  <Text type="secondary">{it.note || "-"}</Text>
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
}
