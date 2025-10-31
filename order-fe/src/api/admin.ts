import { API_BASE_URL } from "../constants/config";

const j = async (r: Response) => {
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};

// 개요 + 추이 (대시보드)
export const getAdminOverview = async () => {
  // 백엔드 orders-stats.js 에서 today / month / trend 제공한다고 가정
  const [ov, tr] = await Promise.all([
    fetch(`${API_BASE_URL}/api/orders/stats/overview`, { cache: "no-store" }).then(j),
    fetch(`${API_BASE_URL}/api/orders/stats/trend?days=7`, { cache: "no-store" }).then(j),
  ]);
  return { overview: ov, trend: tr.list || [] };
};

// 그룹 통계 (품목/부위/UNIT)
export const getOrdersByGroup = async ({ groupBy, dateFrom, dateTo, type, unit }: any) => {
  const q = new URLSearchParams();
  if (groupBy) q.set("groupBy", groupBy);
  if (dateFrom) q.set("dateFrom", dateFrom);
  if (dateTo) q.set("dateTo", dateTo);
  if (type) q.set("type", type);
  if (unit) q.set("unit", unit);
  const url = `${API_BASE_URL}/api/orders/stats/by?${q.toString()}`;
  return fetch(url, { cache: "no-store" })
    .then(j)
    .then((d) => d.list || d || []);
};
////////////////////////////////////////////////////////////////////////////////
// 상품관리//////////////////////////////////////////////////////////////////////
// 상품 목록 (검색/필터)
export const getItemsAdmin = (p: { q?: string; type?: string } = {}) => {
  const qs = new URLSearchParams();
  if (p.q) qs.set("q", p.q);
  if (p.type) qs.set("type", p.type);
  return fetch(`${API_BASE_URL}/api/admin/items?${qs.toString()}`, { cache: "no-store" }).then(j);
};

// 상품 생성
export const createItem = (body: any) =>
  fetch(`${API_BASE_URL}/api/admin/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(j);

// 상품 수정
export const updateItem = (id: number | string, body: any) =>
  fetch(`${API_BASE_URL}/api/admin/items/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(j);

// 상품 삭제
export const deleteItem = async (id: number | string) => {
  return fetch(`${API_BASE_URL}/api/admin/items/${id}`, { method: "DELETE" }).then(j);
};
///////////////////////////////////////////////////////////////////////////////
// 고객관리//////////////////////////////////////////////////////////////////////

export const getCustomers = (p: { q?: string; page?: number; pageSize?: number } = {}) => {
  const qs = new URLSearchParams();
  if (p.q) qs.set("q", p.q);
  if (p.page) qs.set("page", String(p.page));
  if (p.pageSize) qs.set("pageSize", String(p.pageSize));
  return fetch(`${API_BASE_URL}/api/admin/customers?${qs.toString()}`, { cache: "no-store" }).then(j);
};

export const createCustomer = (body: any) =>
  fetch(`${API_BASE_URL}/api/admin/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(j);

export const updateCustomer = (phone_number: string, body: any) =>
  fetch(`${API_BASE_URL}/api/admin/customers/${encodeURIComponent(phone_number)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(j);

export const deleteCustomer = (phone_number: string) =>
  fetch(`${API_BASE_URL}/api/admin/customers/${encodeURIComponent(phone_number)}`, {
    method: "DELETE",
  }).then(j);
///////////////////////////////////////////////////////////////////////////////
// 주문관리//////////////////////////////////////////////////////////////////////

export const getOrders = async (p: any) => {
  const q = new URLSearchParams();
  if (p.dateFrom) q.set("dateFrom", p.dateFrom);
  if (p.dateTo) q.set("dateTo", p.dateTo);
  if (p.status) q.set("status", p.status);
  if (p.q) q.set("q", p.q);
  q.set("page", String(p.page || 1));
  q.set("pageSize", String(p.pageSize || 20));
  return fetch(`${API_BASE_URL}/api/orders/admin/list?${q.toString()}`, { cache: "no-store" }).then(j);
};

// 주문 상세
export const getOrderDetails = async (orderId: number | string) =>
  fetch(`${API_BASE_URL}/api/orders/${orderId}/details`, { cache: "no-store" }).then(j);

// 주문 상태 변경
export const updateOrderStatus = async (orderId: number | string, status: string) =>
  fetch(`${API_BASE_URL}/api/orders/admin/${orderId}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  }).then(j);

// 주문 삭제
export const deleteOrder = async (orderId: number | string) => fetch(`${API_BASE_URL}/api/orders/admin/${orderId}`, { method: "DELETE" }).then(j);
