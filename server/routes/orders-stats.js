import express from "express";
import SQL from "../sql.js";

const router = express.Router();

router.get("/summary", async (req, res) => {
  try {
    console.log("/stats/summary");
    const { customerId, status } = req.query;
    const where = [];
    const args = [];
    if (customerId) {
      where.push("customer_id = ?");
      args.push(customerId);
    }
    if (status) {
      where.push("status = ?");
      args.push(status);
    }
    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // 1) 최근 발주일 (MAX(order_date))
    const lastRows = await SQL.executeQuery(
      `SELECT DATE_FORMAT(MAX(order_date), '%Y-%m-%d') AS last_order_date FROM JUNIL_ORDER_HEADER  ${whereSQL}  `,
      args
    );
    const lastOrderAt = lastRows?.[0]?.last_order_date || null;

    // 2) 이번 달(1일~말일 전날) 발주건수
    //   - [이번 달 1일] >=, [다음 달 1일] < 로 범위 지정
    const monthWhereSQL =
      (whereSQL ? whereSQL + " AND " : "WHERE ") +
      `order_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND order_date <  DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')`;

    const cntRows = await SQL.executeQuery(
      ` SELECT COUNT(*) AS month_count FROM JUNIL_ORDER_HEADER
      ${monthWhereSQL}
      `,
      args
    );

    const monthCount = cntRows?.[0]?.month_count;
    console.log({ customerId: customerId, lastOrderAt: lastOrderAt, monthCount: monthCount });
    res.json({
      lastOrderAt,
      monthCount: monthCount,
    });
  } catch (err) {
    console.error("[/api/orders/summary] error:", err);
    res.status(500).json({ error: "stats_failed", message: err.message });
  }
});

/**
 * 통계 반환:
 * - summary: 총 주문수, 총 수량, 총 금액 (헤더 합계 기반)
 * - byDay: 최근 30일 일자별 주문수 / 수량 / 금액
 * - byCustomer: 고객별 주문수 / 수량 / 금액 TOP 10
 */
router.get("/overview", async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const monthStart = today.slice(0, 7); // YYYY-MM

    // 오늘 주문건수 / 품목수 / 총 금액
    const todayStats = await SQL.executeQuery(
      `SELECT COUNT(DISTINCT H.order_id) AS todayOrders,
        COUNT(DISTINCT D.item_label) AS todayItems,
        IFNULL(SUM(D.amount), 0) AS revenue
      FROM JUNIL_ORDER_HEADER H
      JOIN JUNIL_ORDER_DETAIL D ON H.order_id = D.order_id
      WHERE DATE(H.order_date) = ?
    `,
      [today]
    );

    // 이번달 주문건수
    const monthStats = await SQL.executeQuery(
      `SELECT COUNT(DISTINCT H.order_id) AS monthOrders FROM JUNIL_ORDER_HEADER H
      WHERE DATE_FORMAT(H.order_date, '%Y-%m') = ?
    `,
      [monthStart]
    );

    res.json({
      ...todayStats[0],
      ...monthStats[0],
    });
  } catch (err) {
    console.error("overview error:", err);
    res.status(500).json({ message: "통계 데이터 조회 실패" });
  }
});

/**
 * 📈 2) 최근 N일간 주문추이 (Line Chart)
 * GET /api/orders/stats/trend?days=7
 */
router.get("/trend", async (req, res) => {
  try {
    const days = Number(req.query.days || 7);
    const [rows] = await SQL.db.query(
      `
      SELECT DATE(order_date) AS date, COUNT(*) AS order_count
      FROM JUNIL_ORDER_HEADER
      WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(order_date)
      ORDER BY DATE(order_date)
    `,
      [days]
    );

    res.json({ list: rows });
  } catch (err) {
    console.error("trend error:", err);
    res.status(500).json({ message: "주문추이 조회 실패" });
  }
});

router.get("/", async (_req, res) => {
  try {
    const [[summary]] = await SQL.db.query(`
      SELECT
        COUNT(*)            AS total_orders,
        COALESCE(SUM(total_qty), 0)     AS total_qty,
        COALESCE(SUM(total_amount), 0)  AS total_amount
      FROM JUNIL_ORDER_HEADER
    `);

    const [byDay] = await SQL.db.query(`
      SELECT
        h.order_date,
        COUNT(*)                              AS orders,
        COALESCE(SUM(h.total_qty), 0)         AS total_qty,
        COALESCE(SUM(h.total_amount), 0)      AS total_amount
      FROM JUNIL_ORDER_HEADER h
      GROUP BY h.order_date
      ORDER BY h.order_date DESC
      LIMIT 30
    `);

    const [byCustomer] = await SQL.db.query(`
      SELECT
        c.name                                  AS customer_name,
        COUNT(h.order_id)                        AS orders,
        COALESCE(SUM(h.total_qty), 0)           AS total_qty,
        COALESCE(SUM(h.total_amount), 0)        AS total_amount
      FROM JUNIL_ORDER_HEADER h
      LEFT JOIN JUNIL_CUSTOMERS c ON c.customer_id = h.customer_id
      GROUP BY h.customer_id
      ORDER BY total_amount DESC, orders DESC
      LIMIT 10
    `);

    res.json({ ok: true, summary, byDay, byCustomer });
  } catch (e) {
    console.error("GET /orders-stats error:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

export default router;
