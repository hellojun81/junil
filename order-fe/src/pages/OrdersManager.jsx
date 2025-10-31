// src/pages/OrdersManager.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Card, Space, Button, Table, Typography, Tag,
  DatePicker, Select, Input, Drawer, Descriptions, message, Popconfirm
} from "antd";
import dayjs from "dayjs";
import {
  getOrders, getOrderDetails, updateOrderStatus, deleteOrder
} from "../api/admin";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const statusColor = (s) =>
  s === "PENDING" ? "orange" :
  s === "DELIVERED" ? "green" :
  s === "CANCELLED" ? "red" : "default";

const OrdersManager = () => {
  const [dates, setDates] = useState([dayjs(), dayjs()]);
  const [status, setStatus] = useState();              // PENDING/DELIVERED/CANCELLED
  const [customer, setCustomer] = useState("");        // 고객명 or ID 검색어
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState({ current: 1, pageSize: 20, total: 0 });

  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(null);
  const [detail, setDetail] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const params = useMemo(() => ({
    dateFrom: dates?.[0]?.format("YYYY-MM-DD"),
    dateTo: dates?.[1]?.format("YYYY-MM-DD"),
    status: status || "",
    q: customer || "",
    page: page.current,
    pageSize: page.pageSize,
  }), [dates, status, customer, page.current, page.pageSize]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getOrders(params);
      setRows(res.list || []);
      setPage((p) => ({ ...p, total: res.total || (res.list?.length ?? 0) }));
    } catch (e) {
      message.error("주문 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [params.page, params.pageSize]); // 초기/페이지 변경
  // 필터 변경 시 1페이지로 리셋 후 재조회
  useEffect(() => { setPage((p)=>({ ...p, current: 1 })); }, [dates, status, customer]);

  const openDetail = async (rec) => {
    setSel(rec);
    setOpen(true);
    setDetail([]);
    setDetailLoading(true);
    try {
      const d = await getOrderDetails(rec.order_id);
      setDetail(d.details || []);
    } catch {
      message.error("상세 조회 실패");
    } finally {
      setDetailLoading(false);
    }
  };

  const onChangeStatus = async (newStatus) => {
    if (!sel) return;
    setUpdating(true);
    try {
      await updateOrderStatus(sel.order_id, newStatus);
      message.success("상태가 변경되었습니다.");
      setSel((s) => ({ ...s, status: newStatus }));
      await load();
    } catch {
      message.error("상태 변경 실패");
    } finally {
      setUpdating(false);
    }
  };

  const onDelete = async (rec) => {
    try {
      await deleteOrder(rec.order_id);
      message.success("삭제되었습니다.");
      await load();
      if (sel?.order_id === rec.order_id) setOpen(false);
    } catch {
      message.error("삭제 실패");
    }
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      <Title level={3}>주문관리</Title>

      <Card>
        <Space wrap>
          <RangePicker value={dates} onChange={setDates} allowClear={false} />
          <Select
            allowClear placeholder="상태"
            style={{ width: 160 }}
            value={status}
            onChange={setStatus}
            options={[
              { value: "PENDING", label: "접수됨" },
              { value: "DELIVERED", label: "완료" },
              { value: "CANCELLED", label: "취소" },
            ]}
          />
          <Input
            placeholder="고객명/ID 검색"
            value={customer}
            onChange={(e)=>setCustomer(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Button type="primary" onClick={load}>조회</Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey={(r)=>r.order_id}
          dataSource={rows}
          loading={loading}
          onRow={(rec)=>({ onClick: ()=>openDetail(rec), style: { cursor: "pointer" } })}
          pagination={{
            current: page.current,
            pageSize: page.pageSize,
            total: page.total,
            onChange: (current, pageSize) => setPage({ current, pageSize, total: page.total }),
            showSizeChanger: true,
            pageSizeOptions: [10,20,50,100],
          }}
          columns={[
            { title: "주문일", dataIndex: "order_date", width: 120 },
            { title: "고객", dataIndex: "customer_name" },
            { title: "상태",
              dataIndex: "status",
              width: 120,
              render: (v)=> <Tag color={statusColor(v)}>{v === "PENDING" ? "접수됨" : v === "DELIVERED" ? "완료" : v === "CANCELLED" ? "취소" : v}</Tag>
            },
            { title: "품목수", dataIndex: "item_count", width: 100 },
            { title: "합계(원)", dataIndex: "total_amount", width: 140, align: "right",
              render: (v)=> (v?.toLocaleString?.() ?? v ?? "-")
            },
            { title: "", key: "act", width: 160, render: (_, rec)=>(
              <Space>
                <Button size="small" onClick={(e)=>{ e.stopPropagation(); openDetail(rec); }}>상세</Button>
                <Popconfirm title="삭제하시겠습니까?" onConfirm={(e)=>{ e?.stopPropagation?.(); onDelete(rec); }}>
                  <Button size="small" danger onClick={(e)=>e.stopPropagation()}>삭제</Button>
                </Popconfirm>
              </Space>
            )}
          ]}
        />
      </Card>

      <Drawer
        title={sel ? `주문 상세 #${sel.order_id}` : "주문 상세"}
        open={open}
        onClose={()=>setOpen(false)}
        width={720}
      >
        {sel && (
          <Space direction="vertical" style={{ width: "100%" }} size={16}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="주문일">{sel.order_date}</Descriptions.Item>
              <Descriptions.Item label="상태">
                <Tag color={statusColor(sel.status)}>
                  {sel.status === "PENDING" ? "접수됨" : sel.status === "DELIVERED" ? "완료" : sel.status === "CANCELLED" ? "취소" : sel.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="고객">{sel.customer_name} (#{sel.customer_id})</Descriptions.Item>
              <Descriptions.Item label="총액">{sel.total_amount?.toLocaleString?.()} 원</Descriptions.Item>
              <Descriptions.Item label="메모" span={2}>{sel.note || "-"}</Descriptions.Item>
            </Descriptions>

            <Card title="항목" size="small" loading={detailLoading}>
              <Table
                rowKey={(r, i)=>r.id || `${sel.order_id}-${i}`}
                dataSource={detail}
                size="small"
                pagination={false}
                columns={[
                  { title: "구분", dataIndex: "type", width: 50 },
                  { title: "품목", dataIndex: "label" ,width: 180},
                  { title: "부위", dataIndex: "sub_label", width: 120, render: v=>v || "-" },
                  { title: "수량", dataIndex: "quantity", width: 90 },
                  { title: "단위", dataIndex: "unit", width: 60 },
                  { title: "단가", dataIndex: "price", width: 50, align: "right",
                    render: v => v!=null ? v.toLocaleString() : "-" },
                  { title: "금액", dataIndex: "amount", width: 50, align: "right",
                    render: v => v!=null ? v.toLocaleString() : "-" },
                  { title: "비고", dataIndex: "note", ellipsis: true },
                ]}
              />
            </Card>

            <Space>
              <Button loading={updating} onClick={()=>onChangeStatus("PENDING")}>접수됨</Button>
              <Button loading={updating} type="primary" onClick={()=>onChangeStatus("DELIVERED")}>완료</Button>
              <Button loading={updating} danger onClick={()=>onChangeStatus("CANCELLED")}>취소</Button>
            </Space>
          </Space>
        )}
      </Drawer>
    </Space>
  );
};

export default OrdersManager;
