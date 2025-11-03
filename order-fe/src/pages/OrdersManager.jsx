// src/pages/OrdersManager.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Segmented, Card, Space, Button, Table, Typography, Tag,
  DatePicker, Select, Input, Drawer, Descriptions, message, Popconfirm,
  Divider, Collapse, Skeleton
} from "antd";
import dayjs from "dayjs";
import {
  getOrders, getOrderDetails, updateOrderStatus, deleteOrder,
  getCustomerItemSummary,
  getAllCustomerItemSummary // 있으면 사용, 없으면 폴백
} from "../api/admin";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { Panel } = Collapse;

const statusColor = (s) =>
  s === "PENDING" ? "orange" :
  s === "DELIVERED" ? "green" :
  s === "CANCELLED" ? "red" : "default";

const OrdersManager = () => {
  const [dates, setDates] = useState([dayjs(), dayjs()]);
  const [status, setStatus] = useState();
  const [customer, setCustomer] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState({ current: 1, pageSize: 20, total: 0 });

  // summary(주문상세) | detail(거래처합계: 모달) | all(전체 거래처 인라인)
  const [viewMode, setViewMode] = useState("summary");

  // Drawer: summary/detail 모드에서 사용
  const [open, setOpen] = useState(false);

  // 선택된 행(주문/거래처)
  const [sel, setSel] = useState(null);

  // Drawer 내용
  const [detail, setDetail] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  // 대표발주서 표기(요약/상세 공통)
  const [repInfo, setRepInfo] = useState({ firstLabel: "", extraCount: 0 });

  // 전체 상세(모든 거래처)
  const [allDetail, setAllDetail] = useState([]);   // [{customer_id, customer_name, items:[] , rep?}]
  const [allLoading, setAllLoading] = useState(false);

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
    } catch {
      message.error("주문 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [params.page, params.pageSize]);
  useEffect(() => { setPage((p)=>({ ...p, current: 1 })); }, [dates, status, customer]);

  // ── 유틸 ─────────────────────────────────────────────
  const calcRepInfo = (details = [], itemCountFallback) => {
    const first = details?.[0];
    const firstLabel = first
      ? `${first.label}${first.sub_label ? ` (${first.sub_label})` : ""}`
      : "";
    const totalCount =
      typeof itemCountFallback === "number"
        ? itemCountFallback
        : Array.isArray(details) ? details.length : 0;
    const extraCount = totalCount > 0 ? Math.max(totalCount - 1, 0) : 0;
    return { firstLabel, extraCount };
  };
  const sumBy = (arr, key) =>
    (arr || []).reduce((acc, cur) => acc + (Number(cur?.[key]) || 0), 0);

  // 대표발주서(선택 주문 기준)
  const loadRepInfo = useCallback(async (rec) => {
    try {
      const d = await getOrderDetails(rec.order_id);
      const info = calcRepInfo(d.details || [], rec.item_count);
      setRepInfo(info);
    } catch {
      setRepInfo({ firstLabel: "", extraCount: 0 });
    }
  }, []);

  // 상세 로더(모달용): viewMode에 따라 API 분기
  const loadDetails = useCallback(async (rec) => {
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
      setOpen(true); // ✅ detail/summary 모두 모달로
    } catch (err) {
      console.error("❌ 상세 조회 실패:", err);
      message.error("상세 조회 실패");
    } finally {
      setDetailLoading(false);
    }
  }, [viewMode, params.dateFrom, params.dateTo, loadRepInfo]);

  // 전체 상세(모든 거래처)
  const loadAllDetails = useCallback(async () => {
    setAllDetail([]);
    setAllLoading(true);
    
    try {
      if (typeof getAllCustomerItemSummary === "function") {
        const data = await getAllCustomerItemSummary({
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          status: params.status,
          q: params.q
        });
        console.log('data',data)
        setAllDetail(Array.isArray(data) ? data : []);
      } else {
        // 폴백: 현재 페이지에 보이는 거래처만 병렬 수집
        const uniqCustomers = Array.from(
          new Map((rows || []).map(r => [r.customer_id, { id: r.customer_id, name: r.customer_name }])).values()
        );
        const results = await Promise.all(
          uniqCustomers.map(async (c) => {
            const items = await getCustomerItemSummary({
              customerId: c.id,
              dateFrom: params.dateFrom,
              dateTo: params.dateTo,
            });
            const rep = calcRepInfo(items || [], (items || []).length);
            return { customer_id: c.id, customer_name: c.name, items: items || [], rep };
          })
        );
        setAllDetail(results);
      }
    } catch {
      message.error("전체 상세를 불러오지 못했습니다.");
    } finally {
      setAllLoading(false);
    }
  }, [rows, params.dateFrom, params.dateTo, params.status, params.q]);

  // 모드 전환 시 처리
  useEffect(() => {
    if (viewMode === "all") {
      setOpen(false);
      setSel(null);
      loadAllDetails();
    } else {
      // summary/detail 모드에서는 열려있던 모달 유지/닫힘은 클릭에 의해 제어
      // 필요 시 sel 기준 재조회는 여기서 하지 않음(UX 단순화)
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

  // 고객별 합계(전체 상세 패널 헤더용)
  const calcCustomerTotals = (items = []) => ({
    qty: sumBy(items, "total_qty"),
    amt: sumBy(items, "total_amount"),
    orders: sumBy(items, "orders"),
  });

  // 대표발주서 블록
  const RepresentativeBlock = () => {
    const text =
      repInfo.firstLabel && repInfo.extraCount >= 0
        ? `${repInfo.firstLabel}${repInfo.extraCount > 0 ? ` 외 ${repInfo.extraCount}건` : ""}`
        : "-";
    return (
      <Descriptions
        size="small"
        column={2}
        items={[
          { key: "rep", label: "대표발주서", children: <Text strong>{text}</Text> },
          sel ? { key: "cust", label: "거래처", children: sel.customer_name || "-" } : null,
          sel ? { key: "date", label: "주문일", children: sel.order_date || "-" } : null,
          sel ? {
            key: "status", label: "상태",
            children: (
              <Tag color={statusColor(sel.status)}>
                {sel.status === "PENDING" ? "접수됨" :
                 sel.status === "DELIVERED" ? "완료" :
                 sel.status === "CANCELLED" ? "취소" : sel.status || "-"}
              </Tag>
            )
          } : null,
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
              { label: "상세 보기(단일 거래처)", value: "detail" },   // ✅ 클릭 시 모달
              { label: "전체 상세(모든 거래처)", value: "all" },     // ✅ 전부 펼쳐서 표시
            ]}
          />
          <RangePicker value={dates} onChange={setDates} allowClear={false} />
          <Select /* 상태 필터 자리 */ />
          <Input /* 고객 검색 자리 */ />
          <Button type="primary" onClick={load}>조회</Button>
        </Space>
      </Card>

      {/* 주문 목록 */}
      {viewMode !== "all" && (
  <Card>
    <Table
      rowKey={(r)=>r.order_id}
      dataSource={rows}
      loading={loading}
      onRow={(rec)=>({
        onClick: async () => {
          // ✅ summary/detail: 모달로 오픈
          if (viewMode === "summary" || viewMode === "detail") {
            await loadDetails(rec);
          }
        },
        style: { cursor: (viewMode === "summary" || viewMode === "detail") ? "pointer" : "default" }
      })}
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
        { title: "상태", dataIndex: "status", width: 120,
          render: (v)=> <Tag color={statusColor(v)}>
            {v === "PENDING" ? "접수됨" : v === "DELIVERED" ? "완료" : v === "CANCELLED" ? "취소" : v}
          </Tag>
        },
        { title: "품목수", dataIndex: "item_count", width: 100 },
        { title: "합계(원)", dataIndex: "total_amount", width: 140, align: "right",
          render: (v)=> (v?.toLocaleString?.() ?? v ?? "-")
        },
        { title: "", key: "act", width: 160, render: (_, rec)=>(
          <Space>
            <Button size="small" onClick={async (e)=>{ 
              e.stopPropagation();
              if (viewMode === "summary" || viewMode === "detail") {
                await loadDetails(rec);
              }
            }}>상세</Button>
            <Popconfirm title="삭제하시겠습니까?" onConfirm={async (e)=>{ e?.stopPropagation?.(); await onDelete(rec); }}>
              <Button size="small" danger onClick={(e)=>e.stopPropagation()}>삭제</Button>
            </Popconfirm>
          </Space>
        )}
      ]}
    />
  </Card>
)}

      {/* ✅ 전체 상세(모든 거래처): 하단 인라인, 최초부터 전체 펼침 */}
      {viewMode === "all" && (
        <Card title="전체 상세(모든 거래처)" extra={<Text type="secondary">{params.dateFrom} ~ {params.dateTo}</Text>}>
          {allLoading ? (
            <Skeleton active />
          ) : (
            <>
              <Collapse
                accordion={false}
                defaultActiveKey={allDetail.map(c => String(c.customer_id))} // ✅ 모두 펼침
              >
                {allDetail.map((c) => {
                  const rep = c.rep || calcRepInfo(c.items || [], (c.items || []).length);
                  const totals = calcCustomerTotals(c.items || []);
                  return (
                    <Panel
                      key={String(c.customer_id)}
                      header={
                        <Space split={<Divider type="vertical" />}>
                          <Text strong>{c.customer_name}</Text>
                          <Text>대표발주서: <Text strong>{rep.firstLabel}{rep.extraCount>0 ? ` 외 ${rep.extraCount}건` : ""}</Text></Text>
                          <Text>총 수량: <Text strong>{totals.qty.toLocaleString()}</Text></Text>
                          <Text>총 금액: <Text strong>{totals.amt.toLocaleString()}</Text></Text>
                          <Text>주문건수: <Text strong>{totals.orders.toLocaleString()}</Text></Text>
                        </Space>
                      }
                    >
                      <Table
                        rowKey={(r,i)=>i}
                        dataSource={c.items || []}
                        size="small"
                        pagination={false}
                        columns={[
                          { title: "품목", dataIndex: "label", width: 220 },
                          { title: "단위", dataIndex: "unit", width: 80 },
                          { title: "총 수량", dataIndex: "total_qty", width: 120, align: "right",
                            render: (v)=> typeof v === "number" ? v.toLocaleString() : v ?? "-" },
                          { title: "총 금액", dataIndex: "total_amount", width: 140, align: "right",
                            render: (v)=> typeof v === "number" ? v.toLocaleString() : v ?? "-" },
                          { title: "주문건수", dataIndex: "orders", width: 120, align: "right",
                            render: (v)=> typeof v === "number" ? v.toLocaleString() : v ?? "-" },
                        ]}
                        summary={(pageData)=>(
                          <Table.Summary fixed>
                            <Table.Summary.Row>
                              <Table.Summary.Cell index={0}><Text strong>합계</Text></Table.Summary.Cell>
                              <Table.Summary.Cell index={1} />
                              <Table.Summary.Cell index={2}><Text strong>{sumBy(pageData,"total_qty").toLocaleString()}</Text></Table.Summary.Cell>
                              <Table.Summary.Cell index={3}><Text strong>{sumBy(pageData,"total_amount").toLocaleString()}</Text></Table.Summary.Cell>
                              <Table.Summary.Cell index={4}><Text strong>{sumBy(pageData,"orders").toLocaleString()}</Text></Table.Summary.Cell>
                            </Table.Summary.Row>
                          </Table.Summary>
                        )}
                      />
                    </Panel>
                  );
                })}
              </Collapse>

              {/* 전체 합계 */}
              <Divider />
              {allDetail.length > 0 && (
                <Descriptions size="small" column={3} title="전체 합계">
                  <Descriptions.Item label="거래처 수">
                    <Text strong>{allDetail.length.toLocaleString()}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="총 수량">
                    <Text strong>{
                      allDetail.reduce((a,c)=> a + sumBy(c.items||[],"total_qty"), 0).toLocaleString()
                    }</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="총 금액">
                    <Text strong>{
                      allDetail.reduce((a,c)=> a + sumBy(c.items||[],"total_amount"), 0).toLocaleString()
                    }</Text>
                  </Descriptions.Item>
                </Descriptions>
              )}
            </>
          )}
        </Card>
      )}

      {/* ✅ Drawer: summary(주문 상세) + detail(거래처 합계) 모두 모달로 표시 */}
      <Drawer
        title={
          viewMode === "summary"
            ? (sel ? `주문 상세 #${sel.order_id}` : "주문 상세")
            : (sel ? `거래처별 품목 합계 (${sel.customer_name})` : "거래처별 품목 합계")
        }
        open={open && (viewMode === "summary" || viewMode === "detail")}
        onClose={() => setOpen(false)}
        width={860}
      >
        <Card size="small" bordered>
          <RepresentativeBlock />
          <Divider style={{ margin: "12px 0" }} />
          <Text type="secondary">
            {viewMode === "summary" ? "아래는 선택한 주문의 상세 항목입니다." : "아래는 선택한 거래처의 기간 내 품목별 합계입니다."}
          </Text>
        </Card>

        <Card style={{ marginTop: 12 }} size="small" loading={detailLoading}
              title={viewMode === "summary" ? "주문 항목" : "거래처별 품목 합계"}>
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
                    { title: "수량", dataIndex: "quantity", width: 100, align: "right",
                      render: (v)=> typeof v === "number" ? v.toLocaleString() : v ?? "-" },
                    { title: "단위", dataIndex: "unit", width: 80 },
                    { title: "금액", dataIndex: "amount", width: 120, align: "right",
                      render: (v)=> typeof v === "number" ? v.toLocaleString() : v ?? "-" },
                  ]
                : [
                    { title: "품목", dataIndex: "label", width: 220 },
                    { title: "단위", dataIndex: "unit", width: 80 },
                    { title: "총 수량", dataIndex: "total_qty", width: 120, align: "right",
                      render: (v)=> typeof v === "number" ? v.toLocaleString() : v ?? "-" },
                    { title: "총 금액", dataIndex: "total_amount", width: 140, align: "right",
                      render: (v)=> typeof v === "number" ? v.toLocaleString() : v ?? "-" },
                    { title: "주문건수", dataIndex: "orders", width: 120, align: "right",
                      render: (v)=> typeof v === "number" ? v.toLocaleString() : v ?? "-" },
                  ]
            }
            summary={(pageData) => {
              if (viewMode === "summary") {
                const totalAmt = sumBy(pageData, "amount");
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={3}><Text strong>합계</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={3} />
                      <Table.Summary.Cell index={4} align="right">
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
                      <Table.Summary.Cell index={0}><Text strong>합계</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={1} />
                      <Table.Summary.Cell index={2}><Text strong>{totalQty.toLocaleString()}</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={3}><Text strong>{totalAmt.toLocaleString()}</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={4}><Text strong>{totalOrders.toLocaleString()}</Text></Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              }
            }}
          />
        </Card>

        {viewMode === "summary" && sel && (
          <Space style={{ marginTop: 12 }}>
            <Button onClick={() => onChangeStatus("PENDING")} loading={updating} disabled={sel.status === "PENDING"}>
              접수로 변경
            </Button>
            <Button onClick={() => onChangeStatus("DELIVERED")} loading={updating} disabled={sel.status === "DELIVERED"} type="primary">
              완료로 변경
            </Button>
            <Button onClick={() => onChangeStatus("CANCELLED")} loading={updating} disabled={sel.status === "CANCELLED"} danger>
              취소로 변경
            </Button>
          </Space>
        )}
      </Drawer>
    </Space>
  );
};

export default OrdersManager;
