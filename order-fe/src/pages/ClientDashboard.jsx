// ClientDashboard.jsx
import React, { useEffect, useState, useCallback } from "react";
import {
  Card,
  Typography,
  Button,
  List,
  Space,
  Row,
  Col,
  Tag,
  notification,
  Divider,
  Modal,
  Table,
  message,
} from "antd";
import {
  FireOutlined,
  SmileOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { API_BASE_URL } from "../constants/config";
import QuickOrder from "../components/QuickOrder";
import TodayCartSummary from "../components/TodayCart";
import { useCart } from "../context/CartContext"; // ✅ 추가

const { Title, Text } = Typography;

/* ======================
 * 상태 관련 헬퍼 공통
 * ====================== */

// 색상
const statusColor = (s) => {
  const v = (s || "").toUpperCase();
  if (v === "NEW" || v === "PENDING") return "orange"; // 접수
  if (v === "DELIVERED") return "green"; // 배송완료
  if (v === "CANCELLED") return "red"; // 취소
  if (v === "PARTIAL") return "blue"; // 부분배송
  return "default";
};

// 라벨
const statusLabel = (s) => {
  const v = (s || "").toUpperCase();
  if (v === "NEW" || v === "PENDING") return "접수";
  if (v === "DELIVERED") return "배송완료";
  if (v === "CANCELLED") return "취소";
  if (v === "PARTIAL") return "부분배송";
  return s || "-";
};

// 여러 status 배열로부터 집계 (DELIVERED/PENDING/CANCELLED/PARTIAL)
const getAggregatedStatusFromArray = (statuses = []) => {
  const list = statuses
    .map((s) => (s ? String(s).toUpperCase() : "PENDING"))
    .filter(Boolean);

  if (!list.length) return null;

  const set = new Set(list);

  // 모두 동일
  if (set.size === 1) {
    const only = [...set][0];
    if (only === "DELIVERED") return "DELIVERED";
    if (only === "CANCELLED") return "CANCELLED";
    return "PENDING"; // NEW/PENDING 등은 접수로
  }

  // 섞여 있을 때 DELIVERED가 하나라도 있으면 부분배송
  if (set.has("DELIVERED")) return "PARTIAL";

  // DELIVERED 없이 PENDING/CANCELLED 섞여 있으면 접수 취급
  return "PENDING";
};

// JSX 태그 렌더
const renderStatusTag = (s) => {
  if (!s) return null;
  return <Tag color={statusColor(s)}>{statusLabel(s)}</Tag>;
};

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
  const [selectedStatus, setSelectedStatus] = useState(null); // ✅ 상세 모달 표시용 상태

  const { addOrMergeItems } = useCart();

  const openOrder = (type) => setSelectedType(type);
  const closeOrder = () => setSelectedType(null);

  const handlePutOrderToCart = async (order) => {
    const res = await fetch(
      `${API_BASE_URL}/api/orders/${order.id}/details`,
      { cache: "no-store" }
    );
    let details = [];
    if (res.ok) {
      const json = await res.json();
      if (json.ok) details = json.details || [];
    }
    if (!details.length) details = order.items || [];

    const toAdd = details.map((d) => ({
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
      const stJson = r2.ok ? await r2.json() : {};
      const rec = Array.isArray(recJson?.orders) ? recJson.orders : [];

      // ✅ 각 주문의 items 안에 status가 있으면 그것으로 집계
      const withStatus = rec.map((o) => {
        const itemStatuses = (o.items || [])
          .map((it) => it.status)
          .filter(Boolean);
        const agg = getAggregatedStatusFromArray(itemStatuses);
        return {
          ...o,
          aggregatedStatus: agg || o.status || null,
        };
      });

      setRecent(withStatus);
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
      const res = await fetch(
        `${API_BASE_URL}/api/orders/${orderId}/details`
      );
      const json = await res.json();

      if (json.ok) {
        const normalized = (json.details || []).map((d) => ({
          ...d,
          sub_label: d.sub_label ?? d.subLabel ?? "-", // ← 일관성 있게 변환
          note: d.note === "null" ? "" : d.note ?? "", // ← 문자열 "null" 제거
        }));
        setOrderDetails(normalized);

        // ✅ 디테일 status 기준으로 상태 집계 (부분배송 계산)
        const agg = getAggregatedStatusFromArray(
          normalized.map((d) => d.status).filter(Boolean)
        );
        setSelectedStatus(agg || null);
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
      if (!res.ok)
        throw new Error(
          (await res.text().catch(() => "")) || `HTTP ${res.status}`
        );

      message.success("주문서가 전송되었습니다.");

      try {
        localStorage.removeItem("temp_cart");
      } catch {}
      clear();
      setSendOpen(false);

      await fetchDashboard();
    } catch (err) {
      console.error(err);
      message.error("전송에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSending(false);
    }
  };

  // ✅ 퀵오더 화면
  if (selectedType) {
    return (
      <QuickOrder
        meatType={selectedType}
        onClose={closeOrder}
        onAddItem={(item) => {
          notification.success({
            message: `발주 항목이 임시 목록에 추가되었습니다: ${item.label}`,
          });
        }}
      />
    );
  }

  const summarizeOrder = (o) => {
    const first = o.items?.[0];
    if (!first) return `${o.date} 발주내역`;
    const extraCount = (o.items?.length || 1) - 1;
    const main = `${o.date} ${first.label} · ${first.quantity}${first.unit}`;
    return extraCount > 0 ? `${main} 외 ${extraCount}건` : main;
  };

  // ✅ 전송 검토 모달 테이블 컬럼
  const columns = [
    { title: "구분", dataIndex: "type", key: "type", width: 60 },
    { title: "품목", dataIndex: "label", key: "label", width: 120 },
    {
      title: "부위",
      dataIndex: "subItem",
      key: "subItem",
      width: 100,
      render: (v) => v || "-",
    },
    { title: "수량", dataIndex: "quantity", key: "quantity", width: 90 },
    { title: "단위", dataIndex: "unit", key: "unit", width: 90 },
    { title: "메모", dataIndex: "note", key: "note", ellipsis: true },
  ];

  return (
    <div style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <Card bordered={false}>
        <Space
          direction="vertical"
          style={{ width: "100%", textAlign: "center" }}
        >
          <Title level={3}>안녕하세요, {user?.name}님 👋</Title>
          <Text type="secondary">전일축산 발주 대시보드</Text>
        </Space>
      </Card>

      <Divider>발주하기</Divider>
      <Space
        align="center"
        size="large"
        style={{
          display: "flex",
          justifyContent: "center",
          margin: "20px 0",
        }}
      >
        <Button
          type="primary"
          size="large"
          icon={<FireOutlined />}
          onClick={() => openOrder("소")}
        >
          🐮 소 발주
        </Button>
        <Button
          type="primary"
          size="large"
          icon={<SmileOutlined />}
          onClick={() => openOrder("돼지")}
        >
          🐷 돼지 발주
        </Button>
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
        <Col xs={24} md={12} style={{ maxHeight: 140 }}>
          <Card bordered hoverable style={{ height: "100%" }}>
            <Title level={4}>이달 발주</Title>
            <Text style={{ fontSize: 20, fontWeight: "bold" }}>
              {stats.monthCount}건
            </Text>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card bordered hoverable style={{ height: "100%" }}>
            <Title level={4}>최근 발주일</Title>
            <Text>{stats.lastOrderAt}</Text>
          </Card>
        </Col>
      </Row>

      {/* ✅ 최근 발주 리스트 + 상태 태그 (부분배송 포함) */}
      <Card style={{ marginTop: 80 }} title="최근 발주">
  <List
    dataSource={recent}
    locale={{
      emptyText: (
        <Text type="secondary">최근 발주 내역이 없습니다.</Text>
      ),
    }}
    renderItem={(order) => {
      // ▣ 1) 상품별 status 배열
      const itemStatuses = (order.items || [])
        .map((it) => it.status)
        .filter(Boolean); // null 제외
      console.log('itemStatuses',itemStatuses)
      // ▣ 2) 부분배송 계산
      const aggregated =
        order.aggregatedStatus ||
        getAggregatedStatusFromArray(itemStatuses) ||
        order.status ||
        null;
      console.log('aggregated',aggregated)
      return (
        <List.Item
          onClick={() => {
            setSelectedOrder(order);
            setSelectedStatus(aggregated || null);
            fetchOrderDetails(order.id);
          }}
          style={{
            cursor: "pointer",
            padding: "12px 4px",
            transition: "background 0.2s",
          }}
          actions={[
            <Button
              key="reorder"
              size="small"
              onClick={async (e) => {
                e.stopPropagation();
                await handlePutOrderToCart(order);
              }}
            >
              장바구니
            </Button>,
          ]}
        >
              {/* ▣ 3) 제목 우측에도 작게 상태 표시 */}
                {aggregated && (
                  <span style={{ marginLeft: 8 }}>
                    {renderStatusTag(aggregated)}
                  </span>
                )}
          <List.Item.Meta
            title={
              <Space direction="horizontal">
                <Tag
                  color={
                    order.items?.[0]?.type === "돼지"
                      ? "magenta"
                      : "geekblue"
                  }
                >
                  {order.items?.[0]?.type}
                </Tag>

                <Text strong>{summarizeOrder(order)}</Text>

            
              </Space>
            }
            // description={
            //   aggregated ? (
            //     <span>
            //       주문 상태: {renderStatusTag(aggregated)}
            //     </span>
            //   ) : (
            //     <Text type="secondary">상태 없음</Text>
            //   )
            // }
          />
        </List.Item>
      );
    }}
  />
</Card>

      {/* ✅ 주문 상세 모달 (상단 + 품목별 상태) */}
      <Modal
        title={`발주 상세 (${selectedOrder?.date || ""})`}
        open={!!selectedOrder}
        onCancel={() => {
          setSelectedOrder(null);
          setOrderDetails([]);
          setSelectedStatus(null);
        }}
        footer={null}
        width={600}
        key={selectedOrder?.id}
      >
        {selectedOrder && (
          <>
            <Text strong>
              주문상태:{" "}
              {renderStatusTag(
                selectedStatus || selectedOrder.aggregatedStatus || selectedOrder.status
              )}{" "}
              / 주문번호: {selectedOrder.id}
            </Text>
            <Divider />
            <Table
              rowKey={(r, i) => r.detail_id ?? i}
              columns={[
                { title: "구분", dataIndex: "type", key: "type", width: 60 },
                {
                  title: "품목",
                  dataIndex: "label",
                  key: "label",
                  width: 120,
                },
                {
                  title: "부위",
                  dataIndex: "sub_label",
                  key: "sub_label",
                  width: 100,
                },
                {
                  title: "상태",
                  dataIndex: "status",
                  key: "status",
                  width: 90,
                  render: (v) => renderStatusTag(v || "PENDING"), // 없으면 기본 접수
                },
                {
                  title: "수량",
                  dataIndex: "quantity",
                  key: "quantity",
                  width: 60,
                },
                {
                  title: "단위",
                  dataIndex: "unit",
                  key: "unit",
                  width: 60,
                },
                {
                  title: "비고",
                  dataIndex: "note",
                  key: "note",
                  ellipsis: true,
                },
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
