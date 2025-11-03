// ClientDashboard.jsx
import React, { useEffect, useState ,useCallback} from "react";
import {
  Card, Typography, Button, List, Space, Row, Col, Tag, notification, Divider, Modal, Table, message,
} from "antd";
import { ShoppingCartOutlined, FireOutlined, SmileOutlined, SendOutlined } from "@ant-design/icons";
import { API_BASE_URL } from "../constants/config";
import QuickOrder from "../components/QuickOrder";
import TodayCartSummary from "../components/TodayCart";
import { useCart } from "../context/CartContext"; // ✅ 추가

const { Title, Text } = Typography;

const ClientDashboard = ({ user }) => {
  const [recent, setRecent] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [stats, setStats] = useState({ monthCount: 0, lastOrderAt: "-" });
  const [selectedType, setSelectedType] = useState(null);
  const { cart, clear } = useCart();
  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [orderDetails, setOrderDetails] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // ✅ 강제 새로고침 키

  const openOrder = (type) => setSelectedType(type);
  const closeOrder = () => setSelectedType(null);
const { addOrMergeItems } = useCart();
// console.log('ClientDashboard')
const handlePutOrderToCart = async (order) => {
  const res = await fetch(`${API_BASE_URL}/api/orders/${order.id}/details`, { cache: "no-store" });
  let details = [];
  if (res.ok) {
    const json = await res.json();
    if (json.ok) details = json.details || [];
  }
  if (!details.length) details = order.items || [];

  const toAdd = details.map(d => ({
    type: d.type,
    label: d.label,
    subItem: d.subItem ?? d.sub_label ?? null,
    quantity: Number(d.quantity) || 0,
    unit: d.unit || "KG",
    note: d.note || "",
  }));

  addOrMergeItems(toAdd);
};
 const fetchDashboard = useCallback(async () => {
    try {
      const bust = `_=${Date.now()}`; // ✅ 캐시 버스터
      const cid = user?.customerId ?? "";
      const r1 = await fetch(
        `${API_BASE_URL}/api/orders/extra/recentGroup?customerId=${cid}&${bust}`,
        { cache: "no-store", headers: { "cache-control": "no-cache" } }
      );
      const r2 = await fetch(
        `${API_BASE_URL}/api/orders/stats/summary?customerId=${cid}&${bust}`,
        { cache: "no-store", headers: { "cache-control": "no-cache" } }
      );

      const recJson = r1.ok ? await r1.json() : { orders: [] };
      const stJson  = r2.ok ? await r2.json() : {};
      // const stJson  = r2.ok ? await r2.json() : {};
      const rec     = Array.isArray(recJson?.orders) ? recJson.orders : [];
      // console.log(stJson)
      // ✅ 새 참조 보장
      setRecent([...rec]);
      setStats({
        monthCount: stJson.monthCount ?? 0,
        lastOrderAt: stJson.lastOrderAt ?? "-",
      });
    } catch (e) {
      console.error("recent fetch error:", e);
      setRecent([]);
    }
  }, [user?.customerId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

const fetchOrderDetails = async (orderId) => {
  try {
    setDetailLoading(true);
    const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/details`);
    const json = await res.json();

    if (json.ok) {
      const normalized = (json.details || []).map((d) => ({
        ...d,
        sub_label: d.sub_label ?? d.subLabel ?? "-", // ← 일관성 있게 변환
        note: d.note === "null" ? "" : d.note ?? "", // ← 문자열 "null" 제거
      }));
      setOrderDetails(normalized);
    } else {
      message.error("주문 상세를 불러오지 못했습니다.");
    }
  } catch (err) {
    console.error(err);
    message.error("상세 조회 중 오류 발생");
  } finally {
    setDetailLoading(false);
  }
};

  const openSendModal = () => {
    if (!cart.length) return message.warning("장바구니가 비어 있습니다.");
    setSendOpen(true);
  };

  const onSendOrder = async () => {
    if (!cart.length) return message.warning("장바구니가 비어 있습니다.");
    setSending(true);
    try {
      const payload = {
        customerId: user?.customerId ?? null,
        customerName: user?.name ?? "",
        requestedAt: new Date().toISOString(),
        items: cart.map(({ id, ...rest }) => rest),
      };

      const res = await fetch(`${API_BASE_URL}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.text().catch(()=> "")) || `HTTP ${res.status}`);

      message.success("주문서가 전송되었습니다.");

      // ✅ 전송 직후 처리 순서
      try { localStorage.removeItem("temp_cart"); } catch {}
      clear();
      setSendOpen(false);

      // ✅ 즉시 최신화
      await fetchDashboard();

      // ✅ 그래도 같은 내용이라 렌더가 생략될 수 있으니 강제 리프레시 키 증가
      setRefreshKey((k) => k + 1);

    } catch (err) {
      console.error(err);
      message.error("전송에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSending(false);
    }
  };


  const tag = (s) =>
      s === "NEW" ? (
      <Tag color="blue">신규</Tag> // "NEW" 상태에 대한 명시적인 태그를 추가하는 것이 사용자에게 좋습니다.
    ) : null;

  // ✅ 퀵오더 화면
  if (selectedType) {
    return (
      <QuickOrder
        meatType={selectedType}
        onClose={closeOrder}
        onAddItem={(item) => {
          notification.success({ message: `발주 항목이 임시 목록에 추가되었습니다: ${item.label}` });
        }}
      />
    );
  }
const summarizeOrder = (o) => {
    const first = o.items?.[0];
    if (!first) return `${o.date} 발주내역`;
    const extraCount = (o.items?.length || 1) - 1;
    const main = `${o.date} ${o.status || ""}${first.label} · ${first.quantity}${first.unit}`;
    return extraCount > 0 ? `${main} 외 ${extraCount}건` : main;
  };
  // ✅ 전송 검토 모달 테이블 컬럼
  const columns = [
    { title: "구분", dataIndex: "type", key: "type", width: 60 },
    { title: "품목", dataIndex: "label", key: "label" ,width: 120,},
    { title: "세부", dataIndex: "subItem", key: "subItem", width: 100, render: v => v || "-" },
    { title: "수량", dataIndex: "quantity", key: "quantity", width: 90 },
    { title: "단위", dataIndex: "unit", key: "unit", width: 90 },
    { title: "메모", dataIndex: "note", key: "note", ellipsis: true },
  ];

  return (
    <div style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <Card bordered={false}>
        <Space direction="vertical" style={{ width: "100%", textAlign: "center" }}>
          <Title level={3}>안녕하세요, {user?.name}님 👋</Title>
          <Text type="secondary">전일축산 발주 대시보드</Text>
        </Space>
      </Card>

      <Divider>발주하기</Divider>
      <Space align="center" size="large" style={{ display: "flex", justifyContent: "center", margin: "20px 0" }}>
        <Button type="primary" size="large" icon={<FireOutlined />} onClick={() => openOrder("소")}>🐮 소 발주</Button>
        <Button type="primary" size="large" icon={<SmileOutlined />} onClick={() => openOrder("돼지")}>🐷 돼지 발주</Button>
      </Space>

      {/* 오늘 장바구니 + 전송 버튼 */}
      <TodayCartSummary />
      <Card style={{ marginTop: 8 }}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Button
            type="primary"
            size="large"
            icon={<SendOutlined />}
            onClick={openSendModal}
            disabled={!cart.length}
            block
            loading={sending}
          >
            주문서 전송
          </Button>
          <Text type="secondary" style={{ textAlign: "center" }}>
            전송 전 항목을 한 번 더 확인해 주세요.
          </Text>
        </Space>
      </Card>

      {/* 전송 검토 모달 */}
      <Modal
        title={`주문서 검토 (${cart.length}건)`}
        open={sendOpen}
        onCancel={() => setSendOpen(false)}
        okText="전송"
        cancelText="취소"
        okButtonProps={{ loading: sending, disabled: !cart.length }}
        onOk={onSendOrder}
        width={640}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Text type="secondary">
            고객: <b>{user?.name}</b> / ID: <b>{user?.customerId ?? "-"}</b>
          </Text>
          <Table
            rowKey={(r) => r.id}
            columns={columns}
            dataSource={cart}
            size="small"
            pagination={false}
          />
        </Space>
      </Modal>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12} style={{maxHeight:140}}>
           <Card bordered hoverable style={{ height: "100%" }}>
            <Title level={4}>이달 발주</Title>
            <Text style={{fontSize:20,fontWeight:"bold"}}>{stats.monthCount}건</Text>
          </Card>
        </Col>
        <Col xs={24} md={12}>
         <Card bordered hoverable style={{ height: "100%" }}>
            <Title level={4}>최근 발주일</Title>
            <Text>{stats.lastOrderAt}</Text>
          </Card>
        </Col>
      </Row>

     <Card style={{ marginTop: 80 }} title="최근 발주" >
  <List
    dataSource={recent}
    locale={{ emptyText: <Text type="secondary">최근 발주 내역이 없습니다.</Text> }}
    renderItem={(order) => (
      <List.Item
        onClick={() => {
          setSelectedOrder(order);
          fetchOrderDetails(order.id);
        }}
        style={{
          cursor: "pointer",
          transition: "background 0.2s",
        }}
        actions={[
          <Button
            key="reorder"
            size="small"
            onClick={async (e) => {
      e.stopPropagation(); // 리스트 클릭 이벤트 막기
      await handlePutOrderToCart(order);
    }}
          >
            장바구니
          </Button>,
        ]}
      >
    <List.Item.Meta
          title={
            <Space>
              <Tag color={order.items?.[0]?.type === "돼지" ? "magenta" : "geekblue"}>{order.items?.[0]?.type} </Tag>
              <Text strong>{summarizeOrder(order)}</Text>
            </Space>
          }
          description={<Text type="secondary">{tag(order.status)}</Text>}
        />
      </List.Item>
    )}
  />
</Card>

{/* ✅ 주문 상세 모달 */}
<Modal
  title={`발주 상세 (${selectedOrder?.date || ""})`}
  open={!!selectedOrder}
  onCancel={() => {
    setSelectedOrder(null);
    setOrderDetails([]);
  }}
  footer={null}
  width={600}
   key={selectedOrder?.id}
>
  {console.log('selectedOrder',selectedOrder)}
  {selectedOrder && (
    <>
      <Text strong>
        주문상태: {tag(selectedOrder.status)} / 주문번호: {selectedOrder.id}
      </Text>
      <Divider />
      <Table
        rowKey={(r) => r.id}
        columns={[
          { title: "구분", dataIndex: "type", key: "type", width: 60 },
          { title: "품목", dataIndex: "label", key: "label",width: 120, },
          { title: "세부", dataIndex: "sub_label", key: "sub_label", width: 100},
          { title: "수량", dataIndex: "quantity", key: "quantity", width: 60 },
          { title: "단위", dataIndex: "unit", key: "unit", width: 60 },
          { title: "비고", dataIndex: "note", key: "note", ellipsis: true },
        ]}
        dataSource={orderDetails}
        size="small"
        loading={detailLoading}
        pagination={false}
      />
    </>
  )}
</Modal>

    </div>
  );
};

export default ClientDashboard;
