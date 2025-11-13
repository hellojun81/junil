// src/pages/OrdersManager.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Segmented, Card, Space, Button, Table, Typography, Tag,
  DatePicker, Select, Input, Drawer, Descriptions, message, Popconfirm,
  Divider, Collapse, Skeleton
} from "antd";
import dayjs from "dayjs";
import {
  getOrders,
  getOrderDetails,
  updateOrderStatus,
  deleteOrder,
  getCustomerItemSummary,
  getAllCustomerItemSummary,
  updateOrderDetailStatus,
} from "../api/admin";
import "../styles/antd-custom.css";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { Panel } = Collapse;

const statusColor = (s) =>
  s === "PENDING"
    ? "orange"
    : s === "DELIVERED"
    ? "green"
    : s === "CANCELLED"
    ? "red"
    : s === "PARTIAL"
    ? "blue"
    : "default";

const statusLabel = (s) =>
  s === "PENDING"
    ? "접수"
    : s === "DELIVERED"
    ? "배송완료"
    : s === "CANCELLED"
    ? "취소"
    : s === "PARTIAL"
    ? "부분배송"
    : s || "-";

const STATUS_OPTIONS = [
  { value: "PENDING", label: "접수됨" },
  { value: "DELIVERED", label: "배송완료" },
  { value: "CANCELLED", label: "취소" },
];

const getAggregatedStatusFromDetails = (details = []) => {
  if (!details.length) return "PENDING";

  const set = new Set(
    details.map((d) => (d.status ? d.status.toUpperCase() : "PENDING"))
  );

  if (set.size === 1) {
    const only = [...set][0];
    if (only === "DELIVERED") return "DELIVERED";
    if (only === "CANCELLED") return "CANCELLED";
    return "PENDING";
  }

  if (set.has("DELIVERED")) return "PARTIAL";
  return "PENDING";
};

const OrdersManager = () => {
  const [dates, setDates] = useState([dayjs(), dayjs()]);
  const [status, setStatus] = useState();
  const [customer, setCustomer] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState({ current: 1, pageSize: 20, total: 0 });

  const [viewMode, setViewMode] = useState("summary");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(null);

  const [detail, setDetail] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [repInfo, setRepInfo] = useState({ firstLabel: "", extraCount: 0 });

  const [allDetail, setAllDetail] = useState([]);
  const [allLoading, setAllLoading] = useState(false);

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
      const list = res.list || [];

      const listWithStatus = await Promise.all(
        list.map(async (row) => {
          try {
            const d = await getOrderDetails(row.order_id);
            const agg = getAggregatedStatusFromDetails(d.details || []);
            return { ...row, computedStatus: agg };
          } catch (e) {
            console.error("주문 상태 집계 실패:", e);
            return { ...row, computedStatus: row.status || "PENDING" };
          }
        })
      );

      setRows(listWithStatus);
      setPage((p) => ({
        ...p,
        total: res.total || (listWithStatus?.length ?? 0),
      }));
    } catch {
      message.error("주문 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params.page, params.pageSize]);
  useEffect(() => {
    setPage((p) => ({ ...p, current: 1 }));
  }, [dates, status, customer]);

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

  const sumBy = (arr, key) =>
    (arr || []).reduce((acc, cur) => acc + (Number(cur?.[key]) || 0), 0);

  const loadRepInfo = useCallback(async (rec) => {
    try {
      const d = await getOrderDetails(rec.order_id);
      const info = calcRepInfo(d.details || [], rec.item_count);
      setRepInfo(info);
    } catch {
      setRepInfo({ firstLabel: "", extraCount: 0 });
    }
  }, []);

  const loadDetails = useCallback(
    async (rec) => {
      if (!rec) return;
      setSel(rec);
      setDetail([]);
      setDetailLoading(true);
      try {
        await loadRepInfo(rec);
        if (viewMode === "summary") {
          const d = await getOrderDetails(rec.order_id);
          setDetail(d.details || []);
        } else if (viewMode === "detail") {
          const d = await getCustomerItemSummary({
            customerId: rec.customer_id,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
          });
          setDetail(d || []);
        }
        setOpen(true);
      } catch (err) {
        console.error("❌ 상세 조회 실패:", err);
        message.error("상세 조회 실패");
      } finally {
        setDetailLoading(false);
      }
    },
    [viewMode, params.dateFrom, params.dateTo, loadRepInfo]
  );

  const loadAllDetails = useCallback(
    async () => {
      setAllDetail([]);
      setAllLoading(true);

      try {
        if (typeof getAllCustomerItemSummary === "function") {
          const data = await getAllCustomerItemSummary({
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
            status: params.status,
            q: params.q,
          });
          setAllDetail(Array.isArray(data) ? data : []);
        } else {
          const uniqCustomers = Array.from(
            new Map(
              (rows || []).map((r) => [
                r.customer_id,
                { id: r.customer_id, name: r.customer_name },
              ])
            ).values()
          );
          const results = await Promise.all(
            uniqCustomers.map(async (c) => {
              const items = await getCustomerItemSummary({
                customerId: c.id,
                dateFrom: params.dateFrom,
                dateTo: params.dateTo,
              });
              const rep = calcRepInfo(items || [], (items || []).length);
              return {
                customer_id: c.id,
                customer_name: c.name,
                items: items || [],
                rep,
              };
            })
          );
          setAllDetail(results);
        }
      } catch {
        message.error("전체 상세를 불러오지 못했습니다.");
      } finally {
        setAllLoading(false);
      }
    },
    [rows, params.dateFrom, params.dateTo, params.status, params.q]
  );

  useEffect(() => {
    if (viewMode === "all") {
      setOpen(false);
      setSel(null);
      loadAllDetails();
    }
  }, [viewMode]); // eslint-disable-line

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
      if (sel?.order_id === rec.order_id) {
        setSel(null);
        setDetail([]);
        setOpen(false);
      }
    } catch {
      message.error("삭제 실패");
    }
  };

  const calcCustomerTotals = (items = []) => ({
    qty: sumBy(items, "total_qty"),
    amt: sumBy(items, "total_amount"),
    orders: sumBy(items, "orders"),
  });

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
        column={2}
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
                  <Tag color={statusColor(sel.status)}>
                    {statusLabel(sel.status)}
                  </Tag>
                ),
              }
            : null,
        ].filter(Boolean)}
      />
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
              if (v !== "summary" && v !== "detail") setOpen(false);
            }}
            options={[
              { label: "요약 보기", value: "summary" },
              { label: "전체 상세(모든 거래처)", value: "all" },
            ]}
          />
          <RangePicker value={dates} onChange={setDates} allowClear={false} />
          <Select /* 상태 필터 자리 */ />
          <Input /* 고객 검색 자리 */ />
          <Button type="primary" onClick={load}>
            조회
          </Button>
        </Space>
      </Card>

      {/* 주문 목록 */}
      {viewMode !== "all" && (
        <Card>
          <Table
            rowKey={(r) => r.order_id}
            dataSource={rows}
            loading={loading}
            onRow={(rec) => ({
              onClick: async () => {
                if (viewMode === "summary" || viewMode === "detail") {
                  await loadDetails(rec);
                }
              },
              style: {
                cursor:
                  viewMode === "summary" || viewMode === "detail"
                    ? "pointer"
                    : "default",
              },
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
              { title: "고객", dataIndex: "customer_name", width: 150 },
              {
                title: "상태",
                dataIndex: "computedStatus",
                width: 100,
                render: (_, rec) => {
                  const s = rec.computedStatus || rec.status || "PENDING";
                  return (
                    <Tag color={statusColor(s)}>
                      {statusLabel(s)}
                    </Tag>
                  );
                },
              },
              { title: "품목수", dataIndex: "item_count", width: 80 },
              {
                title: "",
                key: "act",
                width: 160,
                render: (_, rec) => (
                  <Space>
                    <Button
                      size="small"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (viewMode === "summary" || viewMode === "detail") {
                          await loadDetails(rec);
                        }
                      }}
                    >
                      상세
                    </Button>
                    <Popconfirm
                      title="삭제하시겠습니까?"
                      onConfirm={async (e) => {
                        e?.stopPropagation?.();
                        await onDelete(rec);
                      }}
                    >
                      <Button
                        size="small"
                        danger
                        onClick={(e) => e.stopPropagation()}
                      >
                        삭제
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      )}

      {/* 전체 상세(모든 거래처) */}
      {viewMode === "all" && (
        <Card
          title="전체 상세(모든 거래처)"
          extra={
            <Text type="secondary">
              {params.dateFrom} ~ {params.dateTo}
            </Text>
          }
        >
          {allLoading ? (
            <Skeleton active />
          ) : (
            <>
              <Collapse
                accordion={false}
                defaultActiveKey={allDetail.map((c) =>
                  String(c.customer_id)
                )}
              >
                {allDetail.map((c) => {
                  const rep =
                    c.rep ||
                    calcRepInfo(c.items || [], (c.items || []).length);
                  const totals = calcCustomerTotals(c.items || []);
                  return (
                    <Panel
                      key={String(c.customer_id)}
                      header={
                        <Space split={<Divider type="vertical" />}>
                          <Text strong>{c.customer_name}</Text>
                          <Text>
                            발주서:{" "}
                            <Text strong>
                              {rep.firstLabel}
                              {rep.extraCount > 0
                                ? ` 외 ${rep.extraCount}건`
                                : ""}
                            </Text>
                          </Text>
                          <Text>
                            총 수량:{" "}
                            <Text strong>
                              {totals.qty.toLocaleString()}
                            </Text>
                          </Text>
                          <Text>
                            총 금액:{" "}
                            <Text strong>
                              {totals.amt.toLocaleString()}
                            </Text>
                          </Text>
                          <Text>
                            주문건수:{" "}
                            <Text strong>
                              {totals.orders.toLocaleString()}
                            </Text>
                          </Text>
                        </Space>
                      }
                    >
                      <Table
                        rowKey={(r, i) => r.detail_id ?? i}
                        dataSource={c.items || []}
                        size="small"
                        pagination={false}
                        columns={[
                          // 🔹 구분(소/돼지)
                          {
                            title: "구분",
                            dataIndex: "type",
                            width: 80,
                            render: (v) => v || "-",
                          },
                          { title: "품목", dataIndex: "label", width: 220 },
                   
                          { title: "부위", dataIndex: "sub_label", width: 140 },
                                 { title: "단위", dataIndex: "unit", width: 80 },
                          {
                            title: "상태",
                            dataIndex: "status",
                            width: 140,
                            render: (value, row) => {
                              if (row.detail_id) {
                                return (
                                  <Select
                                    size="small"
                                    value={value || "PENDING"}
                                    style={{ width: 120 }}
                                    options={STATUS_OPTIONS}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={async (next) => {
                                      try {
                                        await updateOrderDetailStatus(
                                          row.detail_id,
                                          next
                                        );
                                        message.success("항목 상태가 변경되었습니다.");
                                        setAllDetail((prev) =>
                                          prev.map((cust) =>
                                            cust.customer_id === c.customer_id
                                              ? {
                                                  ...cust,
                                                  items: (cust.items || []).map((it) =>
                                                    it.detail_id === row.detail_id
                                                      ? { ...it, status: next }
                                                      : it
                                                  ),
                                                }
                                              : cust
                                          )
                                        );
                                      } catch (err) {
                                        console.error(
                                          "detail status update error (all view):",
                                          err
                                        );
                                        message.error("항목 상태 변경 실패");
                                      }
                                    }}
                                  />
                                );
                              }
                              return (
                                <Tag color={statusColor(value)}>
                                  {statusLabel(value)}
                                </Tag>
                              );
                            },
                          },
                      {
  title: "총 수량",
  dataIndex: "total_qty",
  align: "right",
  width: 120,
  render: (v) => {
    if (v == null) return "-";
    const num = Number(v);
    return Math.round(num).toLocaleString();  // ★ 소수점 제거!
  },
},
                          {
                            title: "총 금액",
                            dataIndex: "total_amount",
                            width: 140,
                            align: "right",
                            render: (v) =>
                              typeof v === "number"
                                ? v.toLocaleString()
                                : v ?? "-",
                          },
                          {
                            title: "주문건수",
                            dataIndex: "orders",
                            width: 120,
                            align: "right",
                            render: (v) =>
                              typeof v === "number"
                                ? v.toLocaleString()
                                : v ?? "-",
                          },
                        ]}
                        summary={(pageData) => {
                          const totalQty = sumBy(pageData, "total_qty");
                          const totalAmt = sumBy(pageData, "total_amount");
                          const totalOrders = sumBy(pageData, "orders");
                          return (
                            <Table.Summary fixed>
                              <Table.Summary.Row>
                                <Table.Summary.Cell index={0}>
                                  <Text strong>합계</Text>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={1} />
                                <Table.Summary.Cell index={2} />
                                <Table.Summary.Cell index={3} />
                                <Table.Summary.Cell index={4}>
                                  <Text strong>{totalQty.toLocaleString()}</Text>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={5}>
                                  <Text strong>{totalAmt.toLocaleString()}</Text>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={6}>
                                  <Text strong>
                                    {totalOrders.toLocaleString()}
                                  </Text>
                                </Table.Summary.Cell>
                              </Table.Summary.Row>
                            </Table.Summary>
                          );
                        }}
                      />
                    </Panel>
                  );
                })}
              </Collapse>

              <Divider />
              {allDetail.length > 0 && (
                <Descriptions size="small" column={3} title="전체 합계">
                  <Descriptions.Item label="거래처 수">
                    <Text strong>{allDetail.length.toLocaleString()}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="총 수량">
                    <Text strong>
                      {allDetail
                        .reduce(
                          (a, c) =>
                            a + sumBy(c.items || [], "total_qty"),
                          0
                        )
                        .toLocaleString()}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="총 금액">
                    <Text strong>
                      {allDetail
                        .reduce(
                          (a, c) =>
                            a + sumBy(c.items || [], "total_amount"),
                          0
                        )
                        .toLocaleString()}
                    </Text>
                  </Descriptions.Item>
                </Descriptions>
              )}
            </>
          )}
        </Card>
      )}

      {/* Drawer: summary/detail */}
      <Drawer
        title={
          viewMode === "summary"
            ? sel
              ? `주문 상세 #${sel.order_id}`
              : "주문 상세"
            : sel
            ? `거래처별 품목 합계 (${sel.customer_name})`
            : "거래처별 품목 합계"
        }
        open={open && (viewMode === "summary" || viewMode === "detail")}
        onClose={() => setOpen(false)}
        width={860}
      >
        <Card size="small" bordered>
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
          size="small"
          loading={detailLoading}
          title={
            viewMode === "summary" ? "주문 항목" : "거래처별 품목 합계"
          }
        >
          <Table
            rowKey={(r, i) => r.detail_id ?? i}
            dataSource={detail}
            size="small"
            pagination={false}
            columns={
              viewMode === "summary"
                ? [
                    // 🔹 상세 Drawer 에도 구분 표시
                    {
                      title: "구분",
                      dataIndex: "type",
                      width: 80,
                      render: (v) => v || "-",
                    },
                    { title: "품목", dataIndex: "label", width: 200 },
                    { title: "부위", dataIndex: "sub_label", width: 140 },
                    {
                      title: "수량",
                      dataIndex: "quantity",
                      width: 100,
                      align: "right",
                     render: (v) => {
    if (v == null) return "-";
    const num = Number(v);
    return Math.round(num).toLocaleString();  // ★ 소수점 제거!
  },
                    },
                    { title: "단위", dataIndex: "unit", width: 80 },
                    {
                      title: "상태",
                      dataIndex: "status",
                      width: 140,
                      render: (value, row) => (
                        <Select
                          size="small"
                          value={value || "PENDING"}
                          style={{ width: 120 }}
                          options={STATUS_OPTIONS}
                          onClick={(e) => e.stopPropagation()}
                          onChange={async (next) => {
                            if (!row.detail_id) {
                              message.error(
                                "detail_id가 없어 상태를 변경할 수 없습니다."
                              );
                              return;
                            }
                            try {
                              await updateOrderDetailStatus(
                                row.detail_id,
                                next
                              );
                              message.success("항목 상태가 변경되었습니다.");
                              setDetail((prev) =>
                                prev.map((d) =>
                                  d.detail_id === row.detail_id
                                    ? { ...d, status: next }
                                    : d
                                )
                              );
                            } catch (err) {
                              console.error(
                                "detail status update error:",
                                err
                              );
                              message.error("항목 상태 변경 실패");
                            }
                          }}
                        />
                      ),
                    },
                    {
                      title: "금액",
                      dataIndex: "amount",
                      width: 120,
                      align: "right",
                      render: (v) =>
                        typeof v === "number"
                          ? v.toLocaleString()
                          : v ?? "-",
                    },
                  ]
                : [
                    // 🔹 거래처별 합계 Drawer 에도 구분 표시
                    {
                      title: "구분",
                      dataIndex: "type",
                      width: 80,
                      render: (v) => v || "-",
                    },
                    { title: "품목", dataIndex: "label", width: 220 },
                    { title: "부위", dataIndex: "sub_label", width: 140 },
                    { title: "단위", dataIndex: "unit", width: 80 },
                  {
  title: "총 수량",
  dataIndex: "total_qty",
  align: "right",
  width: 120,
  render: (v) => {
    if (v == null) return "-";
    const num = Number(v);
    return Math.round(num).toLocaleString();  // ★ 소수점 제거!
  },
},
                    {
                      title: "총 금액",
                      dataIndex: "total_amount",
                      width: 140,
                      align: "right",
                      render: (v) =>
                        typeof v === "number"
                          ? v.toLocaleString()
                          : v ?? "-",
                    },
                    {
                      title: "주문건수",
                      dataIndex: "orders",
                      width: 120,
                      align: "right",
                      render: (v) =>
                        typeof v === "number"
                          ? v.toLocaleString()
                          : v ?? "-",
                    },
                  ]
            }
            summary={(pageData) => {
              if (viewMode === "summary") {
                const totalAmt = sumBy(pageData, "amount");
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={5}>
                        <Text strong>합계</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={5} align="right">
                        <Text strong>{totalAmt.toLocaleString()}</Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              } else {
                const totalQty = sumBy(pageData, "total_qty");
                const totalAmt = sumBy(pageData, "total_amount");
                const totalOrders = sumBy(pageData, "orders");
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0}>
                        <Text strong>합계</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} />
                      <Table.Summary.Cell index={2}>
                        <Text strong>{totalQty.toLocaleString()}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3}>
                        <Text strong>{totalAmt.toLocaleString()}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4}>
                        <Text strong>{totalOrders.toLocaleString()}</Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              }
            }}
          />
        </Card>
      </Drawer>
    </Space>
  );
};

export default OrdersManager;
