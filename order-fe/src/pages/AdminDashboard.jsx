import React, { useEffect, useState } from "react";
import { Card, Row, Col, Statistic, Typography, Space, Table, Skeleton, message } from "antd";
import { API_BASE_URL } from "../constants/config";
import { AppstoreOutlined, TeamOutlined, ShoppingCartOutlined, SettingOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
// ─── Recharts(있으면 사용, 없으면 폴백) ───────────────────────────────
let ReLineChart = null;
try {
  // eslint-disable-next-line import/no-extraneous-dependencies, global-require
  const recharts = require("recharts");
  ReLineChart = recharts;
} catch (_) {
  ReLineChart = null; // 폴백
}

const { Title, Text } = Typography;

// 공통 fetch json
const j = async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); };

export default function AdminDashboard() {
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState({
    todayOrders: 0,
    todayItems: 0,
    monthOrders: 0,
    revenue: 0,
  });
  const [trend, setTrend] = useState([]);
  const [recent, setRecent] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const nav = useNavigate();
  // 개요 + 추이
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [ov, tr] = await Promise.all([
          fetch(`${API_BASE_URL}/api/orders/stats/overview`, { cache: "no-store" }).then(j),
          fetch(`${API_BASE_URL}/api/orders/stats/trend?days=7`, { cache: "no-store" }).then(j),
        ]);
        setOverview(ov);
        setTrend(tr.list || []);
      } catch (e) {
        console.error(e);
        message.error("대시보드 통계를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 최근 주문 10건
  useEffect(() => {
    (async () => {
      setRecentLoading(true);
      try {
        const q = new URLSearchParams({ page: "1", pageSize: "10" });
        const res = await fetch(`${API_BASE_URL}/api/orders/admin/list?${q}`, { cache: "no-store" }).then(j);
        setRecent(res.list || []);
      } catch {
        message.error("최근 주문을 불러오지 못했습니다.");
      } finally {
        setRecentLoading(false);
      }
    })();
  }, []);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Typography.Title level={3}>관리자 대시보드</Typography.Title>



      {/* 요약 카드 */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>{loading ? <Skeleton active /> : <Statistic title="오늘 주문건수" value={overview.todayOrders} />}</Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>{loading ? <Skeleton active /> : <Statistic title="오늘 품목수" value={overview.todayItems} />}</Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>{loading ? <Skeleton active /> : <Statistic title="이달 주문건수" value={overview.monthOrders} />}</Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            {loading ? (
              <Skeleton active />
            ) : (
              <Statistic title="매출(추정)" value={overview.revenue} prefix="₩" valueStyle={{ fontVariantNumeric: "tabular-nums" }} />
            )}
          </Card>
        </Col>
      </Row>

      {/* 최근 7일 주문 추이 */}
      <Card title="최근 7일 주문 추이">
        {loading ? (
          <Skeleton active />
        ) : ReLineChart ? (
          <div style={{ width: "100%", height: 280 }}>
            <ReLineChart.ResponsiveContainer>
              <ReLineChart.LineChart data={trend} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                <ReLineChart.CartesianGrid strokeDasharray="3 3" />
                <ReLineChart.XAxis dataKey="date" />
                <ReLineChart.YAxis allowDecimals={false} />
                <ReLineChart.Tooltip />
                <ReLineChart.Line type="monotone" dataKey="order_count" stroke="#1677ff" strokeWidth={2} dot={false} />
              </ReLineChart.LineChart>
            </ReLineChart.ResponsiveContainer>
          </div>
        ) : (
          <Text type="secondary">recharts 미설치 상태입니다. `npm i recharts` 설치 시 그래프가 표시됩니다.</Text>
        )}
      </Card>

      {/* 최근 주문 10건 */}
      <Card title="최근 주문">
        <Table
          rowKey={(r) => r.order_id}
          loading={recentLoading}
          dataSource={recent}
          size="small"
          pagination={false}
          columns={[
            { title: "주문일", dataIndex: "order_date", width: 120 },
            { title: "고객", dataIndex: "customer_name", width: 120 },
            {
              title: "상태",
              dataIndex: "status",
              width: 80,
              render: (v) =>
                v === "PENDING" ? "접수됨" : v === "DELIVERED" ? "완료" : v === "CANCELLED" ? "취소" : v || "-",
            },
            { title: "품목수", dataIndex: "item_count", width: 60 },
            // {
            //   title: "합계(원)",
            //   dataIndex: "total_amount",
            //   width: 140,
            //   align: "right",
            //   render: (v) => (v != null ? Number(v).toLocaleString() : "-"),
            // },
          ]}
        />
      </Card>
    </Space>
  );
}
