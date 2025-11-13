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
router.get("/group", async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      groupBy = "label", // label | sub | unit
      type = "전체",      // 소 / 돼지 / 전체
      unit = "전체",      // KG / BOX / EA / 전체
    } = req.query;

    if (!dateFrom || !dateTo) {
      return res.status(400).json({ ok: false, message: "dateFrom, dateTo 필요" });
    }

    // 어떤 컬럼으로 묶을지 결정
    let fieldExpr; // 원본 컬럼
    let alias;     // 응답에서 쓸 이름 (label / sub_label / unit)

    if (groupBy === "sub") {
      fieldExpr = "D.sub_label";
      alias = "sub_label";
    } else if (groupBy === "unit") {
      fieldExpr = "D.unit";
      alias = "unit";
    } else {
      // 기본: 품목명
      fieldExpr = "D.item_label";
      alias = "label";
    }

    // 🚫 공백/NULL 제거용 표현식 (TRIM + IFNULL)
    const valueExpr = `TRIM(IFNULL(${fieldExpr}, ''))`;

    const where = [];
    const params = [];

    // 날짜 필수
    where.push("H.order_date >= ?");
    params.push(dateFrom);
    where.push("H.order_date <= ?");
    params.push(dateTo);

    // 소/돼지 필터
    if (type && type !== "전체") {
      where.push("D.type = ?");
      params.push(type);
    }

    // UNIT 필터 (상단 셀렉트의 UNIT 필터)
    if (unit && unit !== "전체") {
      where.push("D.unit = ?");
      params.push(unit);
    }

    // ✅ 그룹 기준 값이 NULL/빈 문자열인 것은 제외
    where.push(`${valueExpr} <> ''`);

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `SELECT ${valueExpr} AS ${alias}, COALESCE(SUM(D.quantity), 0) AS total_qty,
        COUNT(DISTINCT H.order_id) AS order_count FROM JUNIL_ORDER_HEADER H
      JOIN JUNIL_ORDER_DETAIL D ON H.order_id = D.order_id
      ${whereSQL}
      GROUP BY ${valueExpr}
      ORDER BY total_qty DESC, ${valueExpr} ASC
    `;

    const rows = await SQL.executeQuery(sql, params);
    console.log(rows)
    res.json({
      ok: true,
      groupBy,
      list: rows,
    });
  } catch (err) {
    console.error("GET /api/orders/stats/group error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});



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
router.get("/items", async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      type: meatType, // 소 / 돼지 / ALL
      unit,           // KG / BOX / EA / ALL
    } = req.query;

    const where = [];
    const args = [];

    // 기간필터
    if (dateFrom) {
      where.push("H.order_date >= ?");
      args.push(dateFrom);
    }
    if (dateTo) {
      // dateTo 포함
      where.push("H.order_date < DATE_ADD(?, INTERVAL 1 DAY)");
      args.push(dateTo);
    }

    // ✅ type 은 JUNIL_ITEMS.type 기준으로 필터
    if (meatType && meatType !== "ALL") {
      where.push("I.type = ?");
      args.push(meatType);
    }

    // UNIT 필터
    if (unit && unit !== "ALL") {
      // DETAIL.unit 우선, 없으면 ITEMS.unit
      where.push("(D.unit = ? OR (D.unit IS NULL AND I.unit = ?))");
      args.push(unit, unit);
    }

    // 완전 빈 레코드는 제외
    where.push("(D.item_label IS NOT NULL OR I.label IS NOT NULL)");

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `SELECT COALESCE(I.type, '기타') AS type,       -- 🔸 소/돼지 (items 기준)
        COALESCE(D.item_label, I.label, '(미지정)') AS label,      -- 품목
        COALESCE(D.sub_label, I.sub_label) AS sub_label,  -- 부위
        COALESCE(D.unit, I.unit, 'KG') AS unit,       -- UNIT
        COALESCE(SUM(D.quantity), 0) AS total_qty,
        COUNT(DISTINCT H.order_id) AS order_count
      FROM JUNIL_ORDER_HEADER H
      JOIN JUNIL_ORDER_DETAIL D ON H.order_id = D.order_id
      LEFT JOIN JUNIL_ITEMS I ON D.item_id = I.item_id   -- ✅ type 가져오는 핵심
      ${whereSQL}
      GROUP BY
        COALESCE(I.type, '기타'),
        COALESCE(D.item_label, I.label, '(미지정)'),
        COALESCE(D.sub_label, I.sub_label),
        COALESCE(D.unit, I.unit, 'KG')
      ORDER BY
        type ASC,
        label ASC,
        sub_label ASC,
        unit ASC
    `;

    const rows = await SQL.executeQuery(sql, args);
    console.log(sql)
    res.json({
      ok: true,
      list: rows || [],
    });
  } catch (err) {
    console.error("/api/orders/stats/items error:", err);
    res.status(500).json({
      ok: false,
      error: "items_stats_failed",
      message: err.message,
    });
  }
});
export default router;
