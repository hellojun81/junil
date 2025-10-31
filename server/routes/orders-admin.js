// routes/orders-admin.js
import express from "express";
import SQL from "../sql.js";

const router = express.Router();

// ---- 공통 where builder ----
function buildWhere({ dateFrom, dateTo, status, q }) {
  const where = [];
  const args = [];

  if (dateFrom) {
    where.push("DATE(H.order_date) >= ?");
    args.push(dateFrom);
  }
  if (dateTo) {
    where.push("DATE(H.order_date) <= ?");
    args.push(dateTo);
  }
  if (status) {
    where.push("H.status = ?");
    args.push(status);
  }
  if (q) {
    // 고객명/ID 검색
    where.push("(C.name LIKE ? OR CAST(H.customer_id AS CHAR) LIKE ?)");
    args.push(`%${q}%`, `%${q}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return { whereSql, args };
}

/**
 * 🔎 주문 목록 (관리자)
 * GET /api/orders/admin/list?dateFrom&dateTo&status&q&page=1&pageSize=20
 * 응답: { list: [...], total: 123 }
 */
router.get("/admin/list", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize || "20", 10)));
    const offset = (page - 1) * pageSize;

    const { whereSql, args } = buildWhere({
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      status: req.query.status,
      q: req.query.q,
    });

    // total
    const totalSql = `SELECT COUNT(*) AS total FROM JUNIL_ORDER_HEADER H LEFT JOIN JUNIL_CUSTOMERS C ON C.customer_id = H.customer_id
      ${whereSql}
    `;
    const totalRows = await SQL.executeQuery(totalSql, args);
    const total = totalRows?.[0]?.total || 0;

    // rows
    const listSql = `
      SELECT H.order_id, DATE_FORMAT(H.order_date, '%Y-%m-%d') AS order_date,
        H.customer_id, C.name AS customer_name, H.status, COALESCE(SUM(D.amount), 0) AS total_amount, COUNT(D.order_id) AS item_count
      FROM JUNIL_ORDER_HEADER H LEFT JOIN JUNIL_ORDER_DETAIL D ON D.order_id = H.order_id
      LEFT JOIN JUNIL_CUSTOMERS C ON C.customer_id = H.customer_id
      ${whereSql}
      GROUP BY H.order_id
      ORDER BY H.order_date DESC, H.order_id DESC
      LIMIT ? OFFSET ?
    `;
    const listRows = await SQL.executeQuery(listSql, [...args, pageSize, offset]);

    res.json({ list: listRows, total });
  } catch (err) {
    console.error("admin/list error:", err);
    res.status(500).json({ message: "주문 목록 조회 실패" });
  }
});

/**
 * 🧾 주문 상세 (필요 시 기존 /:id/details 와 동일하게 유지)
 * GET /api/orders/:orderId/details
 * 응답: { ok: true, details: [...] }
 */
router.get("/:orderId/details", async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const sql = `
      SELECT
        D.type,
        D.item_label AS label,
        D.sub_label,
        D.unit,
        D.quantity,
        D.price,
        D.amount,
        D.note
      FROM JUNIL_ORDER_DETAIL D
      WHERE D.order_id = ?
      ORDER BY D.order_id, D.item_label
    `;
    const rows = await SQL.executeQuery(sql, [orderId]);
    res.json({ ok: true, details: rows });
  } catch (err) {
    console.error("details error:", err);
    res.status(500).json({ ok: false, message: "주문 상세 조회 실패" });
  }
});

/**
 * ✏️ 상태 변경
 * PUT /api/orders/admin/:orderId/status { status: "PENDING"|"DELIVERED"|"CANCELLED" }
 */
router.put("/admin/:orderId/status", async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { status } = req.body || {};
    const allow = new Set(["PENDING", "DELIVERED", "CANCELLED"]);
    if (!allow.has(status)) {
      return res.status(400).json({ ok: false, message: "허용되지 않는 상태입니다." });
    }

    const sql = `UPDATE JUNIL_ORDER_HEADER SET status = ? WHERE order_id = ?`;
    const result = await SQL.executeQuery(sql, [status, orderId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "주문을 찾을 수 없습니다." });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("status update error:", err);
    res.status(500).json({ ok: false, message: "상태 변경 실패" });
  }
});

/**
 * 🗑️ 주문 삭제 (헤더+디테일 트랜잭션)
 * DELETE /api/orders/admin/:orderId
 */
router.delete("/admin/:orderId", async (req, res) => {
  const conn = await SQL.db.getConnection();
  try {
    const orderId = req.params.orderId;
    await conn.beginTransaction();

    await conn.query(`DELETE FROM JUNIL_ORDER_DETAIL WHERE order_id = ?`, [orderId]);
    const [r] = await conn.query(`DELETE FROM JUNIL_ORDER_HEADER WHERE order_id = ?`, [orderId]);
    if (r.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "주문을 찾을 수 없습니다." });
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    console.error("order delete error:", err);
    try {
      await conn.rollback();
    } catch {}
    res.status(500).json({ ok: false, message: "주문 삭제 실패" });
  } finally {
    conn.release();
  }
});

export default router;
