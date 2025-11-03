// src/pages/OrdersManager.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Segmented,
  Card,
  Space,
  Button,
  Table,
  Typography,
  Tag,
  DatePicker,
  Select,
  Input,
  Drawer,
  Descriptions,
  message,
  Popconfirm,
  Divider,
} from "antd";
import dayjs from "dayjs";
import {
  getOrders,
  getOrderDetails,
  updateOrderStatus,
  deleteOrder,
  getCustomerItemSummary,
} from "../api/admin";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const statusColor = (s) =>
  s === "PENDING"
    ? "orange"
    : s === "DELIVERED"
    ? "green"
    : s === "CANCELLED"
    ? "red"
    : "default";

const OrdersManager = () => {
  const [dates, setDates] = useState([dayjs(), dayjs()]);
  const [status, setStatus] = useState(); // PENDING/DELIVERED/CANCELLED
  const [customer, setCustomer] = useState(""); // 고객명 or ID 검색어
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState({ current: 1, pageSize: 20, total: 0 });
  const [viewMode, setViewMode] = useState("summary"); // 'summary' | 'detail'

  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(null);
  const [detail, setDetail] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  // 대표발주서 표기를 위한 별도 상태: firstLabel, extraCount
  const [repInfo, setRepInfo] = useState({ firstLabel: "", extraCount: 0 });

  const params = useMemo(
    () => ({
      dateFrom: dates?.[0]?.format("YYYY-MM-DD"),
      dateTo: dates?.[1]?.format("YYYY-MM-DD"),
      status: status || "",
      q: customer || "",
      page: page.current,
      pageSize: page.pageSize,
    }),
    [dates, status, customer, page.current, page.pageSize]
  );

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

  useEffect(() => {
    load();
  }, [params.page, params.pageSize]); // 초기/페이지 변경

  // 필터 변경 시 1페이지로 리셋 후 재조회
  useEffect(() => {
    setPage((p) => ({ ...p, current: 1 }));
  }, [dates, status, customer]);

  // 대표발주서 표기 계산 유틸
  const calcRepInfo = (details = [], itemCountFallback) => {
    const first = details?.[0];
    const firstLabel = first
      ? `${first.label}${first.sub_label ? ` (${first.sub_label})` : ""}`
      : "";
    const totalCount =
      typeof itemCountFallback === "number"
        ? itemCountFallback
        : Array.isArray(details)
        ? details.length
        : 0;
    const extraCount = totalCount > 0 ? Math.max(totalCount - 1, 0) : 0;
    return { firstLabel, extraCount };
  };

  // 대표발주서 표기를 위해 선택 주문의 상세를 한 번 조회 (요약/상세 둘 다 상단에 표시)
  const loadRepInfo = useCallback(
    async (rec) => {
      try {
        const d = await getOrderDetails(rec.order_id);
        const info = calcRepInfo(d.details || [], rec.item_count);
        setRepInfo(info);
      } catch (e) {
        // 대표표기 실패 시 초기화
        setRepInfo({ firstLabel: "", extraCount: 0 });
      }
    },
    []
  );

  const openDetail = useCallback(
    async (rec) => {
      if (!rec) return;
      setSel(rec);
      setOpen(true);
      setDetail([]);
      setDetailLoading(true);

      try {
        // 대표발주서 표기는 항상 먼저 세팅
        await loadRepInfo(rec);

        if (viewMode === "summary") {
          const d = await getOrderDetails(rec.order_id);
          setDetail(d.details || []);
        } else {
          const d = await getCustomerItemSummary({
            customerId: rec.customer_id,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
          });
          setDetail(d || []);
        }
      } catch (err) {
        console.error("❌ openDetail 오류:", err);
        message.error("상세 조회 실패");
      } finally {
        setDetailLoading(false);
      }
    },
    [viewMode, params.dateFrom, params.dateTo, loadRepInfo]
  );

  // Drawer가 열려 있고 선택된 주문이 있을 때, 보기 모드가 바뀌면 재조회
  useEffect(() => {
    if (open && sel) {
      openDetail(sel);
    }
  }, [viewMode, open, sel, openDetail]);

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

  // 공통: 대표발주서 표시 컴포넌트
  const RepresentativeBlock = () => {
    const text =
      repInfo.firstLabel && repInfo.extraCount >= 0
        ? `${repInfo.firstLabel}${
            repInfo.extraCount > 0 ? ` 외 ${repInfo.extraCount}건` : ""
          }`
        : "-";
    return (
      <Descriptions
        size="small"
        column={1}
        items={[
          {
            key: "rep",
            label: "대표발주서",
            children: <Text strong>{text}</Text>,
          },
          sel
            ? {
                key: "cust",
                label: "거래처",
                children: sel.customer_name || "-",
              }
            : null,
          sel
            ? {
                key: "date",
                label: "주문일",
                children: sel.order_date || "-",
              }
            : null,
          sel
            ? {
                key: "status",
                label: "상태",
                children: (
                  <Tag color={statusColor(sel.status)} style={{ marginLeft: 0 }}>
                    {sel.status === "PENDING"
                      ? "접수됨"
                      : sel.status === "DELIVERED"
                      ? "완료"
                      : sel.status === "CANCELLED"
                      ? "취소"
                      : sel.status || "-"}
                  </Tag>
                ),
              }
            : null,
        ].filter(Boolean)}
      />
    );
  };

  // 상세(고객별 품목 집계) 표 하단 합계 렌더
  const DetailSummaryRow = (pageData) => {
    const totalQty = pageData.reduce(
      (acc, cur) => acc + (Number(cur.total_qty) || 0),
      0
    );
    const totalAmt = pageData.reduce(
      (acc, cur) => acc + (Number(cur.total_amount) || 0),
      0
    );
    return (
      <Table.Summary fixed>
        <Table.Summary.Row>
          <Table.Summary.Cell index={0} colSpan={2}>
            <Text strong>합계</Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={2}>
            <Text strong>{totalQty.toLocaleString()}</Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={3}>
            <Text strong>{totalAmt.toLocaleString()}</Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={4} />
        </Table.Summary.Row>
      </Table.Summary>
    );
  };

  // 요약(주문 상세항목) 표 하단 합계 렌더
  const OrderSummaryRow = (pageData) => {
    const totalQty = pageData.reduce(
      (acc, cur) => acc + (Number(cur.quantity) || 0),
      0
    );
    const totalAmt = pageData.reduce(
      (acc, cur) => acc + (Number(cur.amount) || 0),
      0
    );
    return (
      <Table.Summary fixed>
        <Table.Summary.Row>
          <Table.Summary.Cell index={0} colSpan={3}>
            <Text strong>합계</Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={3} />
          <Table.Summary.Cell index={4} align="right">
            <Text strong>{totalAmt.toLocaleString()}</Text>
          </Table.Summary.Cell>
        </Table.Summary.Row>
      </Table.Summary>
    );
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      <Title level={3}>주문관리</Title>

      <Card>
        <Space wrap>
          <Segmented
            value={viewMode}
            onChange={(v) => {
              setViewMode(v);
              if (sel) {
                openDetail(sel);
              }
            }}
            options={[
              { label: "요약 보기", value: "summary" },
              { label: "상세 보기", value: "detail" },
            ]}
          />
          <RangePicker value={dates} onChange={setDates} allowClear={false} />
          <Select /* 상태 등 추가 필터 자리 */ />
          <Input /* 고객 검색 등 추가 필터 자리 */ />
          <Button type="primary" onClick={load}>
            조회
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey={(r) => r.order_id}
          dataSource={rows}
          loading={loading}
          onRow={(rec) => ({
            onClick: () => openDetail(rec),
            style: { cursor: "pointer" },
          })}
          pagination={{
            current: page.current,
            pageSize: page.pageSize,
            total: page.total,
            onChange: (current, pageSize) =>
              setPage({ current, pageSize, total: page.total }),
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
          }}
          columns={[
            { title: "주문일", dataIndex: "order_date", width: 120 },
            { title: "고객", dataIndex: "customer_name" },
            {
              title: "상태",
              dataIndex: "status",
              width: 120,
              render: (v) => (
                <Tag color={statusColor(v)}>
                  {v === "PENDING"
                    ? "접수됨"
                    : v === "DELIVERED"
                    ? "완료"
                    : v === "CANCELLED"
                    ? "취소"
                    : v}
                </Tag>
              ),
            },
            { title: "품목수", dataIndex: "item_count", width: 100 },
            {
              title: "합계(원)",
              dataIndex: "total_amount",
              width: 140,
              align: "right",
              render: (v) => v?.toLocaleString?.() ?? v ?? "-",
            },
            {
              title: "",
              key: "act",
              width: 200,
              render: (_, rec) => (
                <Space>
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetail(rec);
                    }}
                  >
                    상세
                  </Button>
                  <Popconfirm
                    title="삭제하시겠습니까?"
                    onConfirm={(e) => {
                      e?.stopPropagation?.();
                      onDelete(rec);
                    }}
                  >
                    <Button size="small" danger onClick={(e) => e.stopPropagation()}>
                      삭제
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        title={
          viewMode === "summary"
            ? sel && `주문 상세 #${sel.order_id}`
            : sel && `거래처별 품목 합계 (${sel.customer_name})`
        }
        open={open}
        onClose={() => setOpen(false)}
        width={860}
      >
        <Card size="small" bordered>
          {/* 상단: 대표발주서 블럭 (요약/상세 공통) */}
          <RepresentativeBlock />
          <Divider style={{ margin: "12px 0" }} />
          <Text type="secondary">
            {viewMode === "summary"
              ? "아래는 선택한 주문의 상세 항목입니다."
              : "아래는 선택한 거래처의 기간 내 품목별 합계입니다."}
          </Text>
        </Card>

        <Card
          style={{ marginTop: 12 }}
          title={viewMode === "summary" ? "주문 항목" : "거래처별 품목 합계"}
          size="small"
          loading={detailLoading}
        >
          <Table
            rowKey={(r, i) => i}
            dataSource={detail}
            size="small"
            pagination={false}
            columns={
              viewMode === "summary"
                ? [
                    { title: "품목", dataIndex: "label", width: 200 },
                    { title: "부위", dataIndex: "sub_label", width: 140 },
                    {
                      title: "수량",
                      dataIndex: "quantity",
                      width: 100,
                      align: "right",
                      render: (v) =>
                        typeof v === "number" ? v.toLocaleString() : v ?? "-",
                    },
                    { title: "단위", dataIndex: "unit", width: 80 },
                    {
                      title: "금액",
                      dataIndex: "amount",
                      width: 120,
                      align: "right",
                      render: (v) =>
                        typeof v === "number" ? v.toLocaleString() : v ?? "-",
                    },
                  ]
                : [
                    { title: "품목", dataIndex: "label", width: 220 },
                    { title: "단위", dataIndex: "unit", width: 80 },
                    {
                      title: "총 수량",
                      dataIndex: "total_qty",
                      width: 120,
                      align: "right",
                      render: (v) =>
                        typeof v === "number" ? v.toLocaleString() : v ?? "-",
                    },
                    {
                      title: "총 금액",
                      dataIndex: "total_amount",
                      width: 140,
                      align: "right",
                      render: (v) =>
                        typeof v === "number" ? v.toLocaleString() : v ?? "-",
                    },
                    {
                      title: "주문건수",
                      dataIndex: "orders",
                      width: 120,
                      align: "right",
                      render: (v) =>
                        typeof v === "number" ? v.toLocaleString() : v ?? "-",
                    },
                  ]
            }
            summary={
              viewMode === "summary"
                ? (pageData) => OrderSummaryRow(pageData)
                : (pageData) => DetailSummaryRow(pageData)
            }
          />
        </Card>

        {viewMode === "summary" && sel && (
          <Space style={{ marginTop: 12 }}>
            <Button
              onClick={() => onChangeStatus("PENDING")}
              loading={updating}
              disabled={sel.status === "PENDING"}
            >
              접수로 변경
            </Button>
            <Button
              onClick={() => onChangeStatus("DELIVERED")}
              loading={updating}
              disabled={sel.status === "DELIVERED"}
              type="primary"
            >
              완료로 변경
            </Button>
            <Button
              onClick={() => onChangeStatus("CANCELLED")}
              loading={updating}
              disabled={sel.status === "CANCELLED"}
              danger
            >
              취소로 변경
            </Button>
          </Space>
        )}
      </Drawer>
    </Space>
  );
};

export default OrdersManager;
