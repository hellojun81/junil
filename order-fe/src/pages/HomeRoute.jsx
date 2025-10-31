import React, { useState } from "react";
import { Button, Typography, List, Divider, Modal, Drawer, Badge, notification } from "antd";
import { DeleteOutlined, ShoppingCartOutlined } from "@ant-design/icons";
import styled from "styled-components";
import {API_BASE_URL} from "../constants/config";
import QuickOrder from "../components/QuickOrder";
import { useAuth } from "../context/AuthContext";

const { Title, Text } = Typography;

const MOCK_RECENT_ORDERS = [
  { id: 1, date: "10/27", type: "소", label: "전각", value: "전각", subItem: "꾸리", quantity: 5, unit: "박스", note: "빠르게 부탁" },
  { id: 2, date: "10/26", type: "돼지", label: "삼겹살", value: "삼겹살", subItem: null, quantity: 10, unit: "키로", note: "" },
  { id: 3, date: "10/26", type: "소", label: "등심", value: "등심", subItem: null, quantity: 2, unit: "팩(판)", note: "크게 썰어주세요" },
];
const MOCK_PAST_ORDERS = [
  { id: 101, date: "2025-10-25", totalItems: 3, summary: "소 등심 외 2건" },
  { id: 102, date: "2025-10-24", totalItems: 1, summary: "돼지 목살 5키로" },
];

const HomeRoute = () => {
  const { user } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [initialOrder, setInitialOrder] = useState(null);
  const [finalOrderList, setFinalOrderList] = useState([]);

  const handleOpenModal = (type, order = null) => {
    setSelectedType(type);
    setInitialOrder(order);
    setIsModalOpen(true);
  };
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedType(null);
    setInitialOrder(null);
  };

  const handleAddItem = (item) => {
    setFinalOrderList((prev) => [...prev, item]);
    notification.success({ message: `[${item.label}] 발주 목록에 추가됨`, duration: 1.5 });
  };

  const handleRemoveItem = (id) => {
    setFinalOrderList((prev) => prev.filter((i) => i.id !== id));
    notification.info({ message: "임시 목록에서 항목이 삭제되었습니다.", duration: 1.5 });
  };

  const submitFinalOrder = async () => {
    if (finalOrderList.length === 0) {
      notification.warning({ message: "발주 목록이 비어있습니다." });
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Phone-Number": user.phoneNumber },
        body: JSON.stringify({ userId: user.customerId, orders: finalOrderList }),
      });
      if (res.ok) {
        notification.success({
          message: `총 ${finalOrderList.length}건 발주가 완료되었습니다!`,
          description: "담당자 확인 후 처리될 예정입니다.",
          duration: 3,
        });
        setFinalOrderList([]);
        setIsDrawerOpen(false);
      } else {
        notification.error({ message: "발주 전송에 실패했습니다. 서버 상태를 확인하세요." });
      }
    } catch {
      notification.error({ message: "네트워크 오류가 발생했습니다." });
    }
  };

  return (
    <MainContainer>
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 1000 }}>
        <Button
          size="large"
          icon={
            <Badge count={finalOrderList.length} showZero={false}>
              <ShoppingCartOutlined style={{ fontSize: 20 }} />
            </Badge>
          }
          onClick={() => setIsDrawerOpen(true)}
          style={{ marginRight: 8 }}
        >
          발주 목록
        </Button>
      </div>

      <Title level={2} style={{ marginTop: 50 }}>
        전일축산 발주서작성
      </Title>
      <Text type="secondary">({user.name}님, 안녕하세요!)</Text>

      <div style={{ margin: "40px 0" }}>
        <SelectButton type="primary" onClick={() => handleOpenModal("소")}>
          🐮 소 발주
        </SelectButton>
        <SelectButton type="primary" onClick={() => handleOpenModal("돼지")}>
          🐷 돼지 발주
        </SelectButton>
      </div>

      <Divider>최근 발주 내역</Divider>

      <RecentOrderList
        dataSource={MOCK_RECENT_ORDERS}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              title={
                <Text strong>
                  [{item.type}] {item.label} {item.subItem && `(${item.subItem})`}
                </Text>
              }
              description={`${item.date} 발주 | ${item.quantity}${item.unit} | ${item.note || "특이사항 없음"}`}
            />
            <Button size="small" onClick={() => handleOpenModal(item.type, item)}>
              재발주
            </Button>
          </List.Item>
        )}
      />

      <Modal
        title={null}
        open={isModalOpen}
        onCancel={handleCloseModal}
        footer={null}
        centered
        width={"100%"}
        style={{ maxWidth: 600, top: 20 }}
        bodyStyle={{ padding: 0 }}
      >
        <QuickOrder
          meatType={selectedType}
          onClose={handleCloseModal}
          initialOrder={initialOrder}
          onAddItem={handleAddItem}
          addedItems={finalOrderList}
        />
      </Modal>

      <Drawer title="내 발주서 보기" placement="right" onClose={() => setIsDrawerOpen(false)} open={isDrawerOpen}>
        <Title level={4}>현재 임시 발주 목록 ({finalOrderList.length}건)</Title>
        <List
          dataSource={finalOrderList}
          locale={{ emptyText: <Text type="secondary">현재 발주 목록에 추가된 품목이 없습니다.</Text> }}
          renderItem={(item) => (
            <OrderItem key={item.id}>
              <div>
                <Text strong>
                  [{item.type}] {item.label}
                  {item.subItem && <Text type="secondary"> ({item.subItem})</Text>}
                </Text>
                <Text type="secondary" style={{ display: "block" }}>
                  {item.quantity}
                  {item.unit} / {item.note || "특이사항 없음"}
                </Text>
              </div>
              <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveItem(item.id)} />
            </OrderItem>
          )}
        />
        <Divider />
        <div style={{ padding: "16px 0", background: "#fff" }}>
          <Button type="primary" size="large" onClick={submitFinalOrder} block disabled={finalOrderList.length === 0}>
            총 {finalOrderList.length}건 발주서 전송
          </Button>
        </div>
        <Divider />
        <Title level={4} style={{ marginTop: 20 }}>
          지난 발주 기록 (Mock)
        </Title>
        <List
          dataSource={MOCK_PAST_ORDERS}
          renderItem={(i) => (
            <List.Item>
              <List.Item.Meta title={<Text strong>{i.date} 발주</Text>} description={`${i.summary} | 총 ${i.totalItems}건`} />
            </List.Item>
          )}
        />
        <Divider />
        <Text type="secondary">총 {MOCK_PAST_ORDERS.length}건의 발주 내역이 있습니다.</Text>
      </Drawer>
    </MainContainer>
  );
};

export default HomeRoute;

// styles
const MainContainer = styled.div`
  max-width: 450px;
  margin: 0 auto;
  padding: 16px;
  text-align: center;
  min-height: 100vh;
`;
const SelectButton = styled(Button)`
  width: 150px;
  height: 60px;
  margin: 0 10px;
  font-size: 24px;
  font-weight: bold;
`;
const RecentOrderList = styled(List)`
  text-align: left;
  .ant-list-item {
    padding: 12px 0;
  }
`;
const OrderItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
`;
