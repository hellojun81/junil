// src/pages/OrderStats.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  DatePicker,
  Tabs,
  Select,
  Button,
  Table,
  Typography,
  Space,
  message,
} from "antd";
import dayjs from "dayjs";
import { API_BASE_URL } from "../constants/config";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

const typeOptions = [
  { label: "전체", value: "" },
  { label: "소", value: "소" },
  { label: "돼지", value: "돼지" },
];

const unitOptions = [
  { label: "전체", value: "" },
  { label: "KG", value: "KG" },
  { label: "BOX", value: "BOX" },
  { label: "EA", value: "EA" },
];

const OrderStats = () => {
  const [range, setRange] = useState([dayjs().startOf("month"), dayjs()]);
  const [type, setType] = useState("");
  const [unit, setUnit] = useState("");
  const [tab, setTab] = useState("label"); // label | sub | unit
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const params = useMemo(
    () => ({
      dateFrom: range?.[0]?.format("YYYY-MM-DD"),
      dateTo: range?.[1]?.format("YYYY-MM-DD"),
      groupBy: tab,
      type,
      unit,
    }),
    [range, tab, type, unit]
  );

  const load = async () => {
    if (!params.dateFrom || !params.dateTo) {
      return message.warning("기간을 선택해 주세요.");
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams(
        Object.entries(params).reduce((acc, [k, v]) => {
          if (v !== undefined && v !== null && v !== "") acc[k] = v;
          return acc;
        }, {})
      );
      const res = await fetch(
        `${API_BASE_URL}/api/orders/stats/items?${qs.toString()}`
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || "통계 조회 실패");
      }
      setRows(json.list || []);
    } catch (e) {
      console.error(e);
      message.error("통계 조회에 실패했습니다.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]); // 탭 전환 시 자동 조회 (원하면 type, unit, range 바뀔 때도 자동 조회 가능)

  // 첫 번째 컬럼 라벨/키
  const firstCol = useMemo(() => {
    if (tab === "sub") {
      return { title: "부위", dataIndex: "key" };
    }
    if (tab === "unit") {
      return { title: "UNIT", dataIndex: "key" };
    }
    return { title: "품목", dataIndex: "key" }; // label
  }, [tab]);
const renderType = (row) => {
  const type = row.type || "";              // 소 / 돼지
  return `${type ? `${type} ` : ""}`;
};
const renderItemLabel = (row) => {
  const label = row.label || "";            // 갈비
   return `${label}`;
};
const renderSubLabel = (row) => {
  const sub = row.sub_label;
  if (!sub || sub === "null" || sub.trim() === "") return ""; 
  // null, "null", "", " " 모두 숨김
  return ` (${sub})`;
};



  const columns = [
      {
    title: "구분",
    dataIndex: "type",
    key: "type",
    render: (_, row) => <span>{renderType(row)}</span>,
  },
  {
    title: "품목",
    dataIndex: "label",
    key: "label",
    render: (_, row) => <span>{renderItemLabel(row)}</span>,
  },
    {
    title: "부위",
    dataIndex: "sub_label",
    key: "sub_label",
    render: (_, row) => <span>{renderSubLabel(row)}</span>,
  },
  {
    title: "단위",
    dataIndex: "unit",
    key: "unit",
    width: 80,
    render: (v) => v || "-",
  },
  {
    title: "수량",
    dataIndex: "total_qty",
    key: "total_qty",
    align: "right",
    width: 120,
    render: (v) => (v != null ? Number(v).toLocaleString() : "0"),
  },
  {
    title: "주문건수",
    dataIndex: "order_count",
    key: "order_count",
    align: "right",
    width: 120,
    render: (v) => (v != null ? Number(v).toLocaleString() + "건" : "0건"),
  },
];

  function formatItemRow(row) {
  const type = row.type || "";
  const label = row.label || "";
  const sub = row.sub_label ? `(${row.sub_label})` : "";
  const qty = Number(row.total_qty).toFixed(2).replace(/\.00$/, "");

  // 단위 한국식 표기 변환
  const unitKo = {
    KG: "kg",
    BOX: "박스",
    EA: "개",
  }[row.unit] || row.unit;

  return `${type} ${label} ${sub} · ${qty}${unitKo} (${row.order_count}건)`;
}

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>주문 통계</Title>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker
            value={range}
            onChange={setRange}
            allowClear={false}
          />
          <Select
            style={{ width: 140 }}
            value={type}
            onChange={setType}
            options={typeOptions}
            placeholder="구분(소/돼지)"
          />
          <Select
            style={{ width: 120 }}
            value={unit}
            onChange={setUnit}
            options={unitOptions}
            placeholder="UNIT"
          />
          <Button type="primary" onClick={load}>
            조회
          </Button>
        </Space>
      </Card>

      <Card>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: "label", label: "품목별" },
            // { key: "sub", label: "부위별" },
            // { key: "unit", label: "UNIT별" },
          ]}
        />

        <Table
          rowKey={(r, i) => r.key ?? i}
          dataSource={rows}
          loading={loading}
          pagination={false}
          columns={columns}
          locale={{
            emptyText: (
              <div style={{ padding: 40, textAlign: "center" }}>
                <Text type="secondary">No data</Text>
              </div>
            ),
          }}
        />
      </Card>
    </div>
  );
};

export default OrderStats;
