import express from "express";
import SQL from "../sql.js";

const router = express.Router();
const normalizeRow = (row) => {
  const out = {};
  for (const k in row) {
    const v = row[k];
    if (v && typeof v === "object" && v.type === "Buffer" && Array.isArray(v.data)) {
      out[k] = Buffer.from(v.data).toString("utf8");
    } else {
      out[k] = v;
    }
  }
  return out;
};

// 날짜 "MM/DD" 포맷터 (서버에서 문자열로 만들어줌)
const formatMMDD = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${m}/${day}`;
};
router.get("/:orderId/details", async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log(orderId);
    const rows = await SQL.executeQuery(
      ` SELECT  
      d.detail_id,
      d.order_id AS id,
        COALESCE(d.item_label, i.label) AS label,COALESCE(d.sub_label,  i.sub_label) AS sub_label,
        COALESCE(i.type, d.item_label) AS type,
        COALESCE(d.unit, i.unit) AS unit,
        d.quantity,
        d.price,
        d.amount,
        d.status,
        d.note
      FROM JUNIL_ORDER_DETAIL d
      LEFT JOIN JUNIL_ITEMS i ON i.item_id = d.item_id
      WHERE d.order_id = ?
      ORDER BY d.detail_id ASC
      `,
      [orderId]
    );
console.log("details sample row =", rows);
    const normalize = (r) => {
      const out = {};
      for (const k in r) {
        const v = r[k];
        if (v && typeof v === "object" && v.type === "Buffer") {
          out[k] = Buffer.from(v.data).toString("utf8");
        } else {
          out[k] = v;
        }
      }
      return out;
    };

    res.json({ ok: true, details: rows.map(normalize) });
  } catch (e) {
    console.error("/api/orders/:orderId/details error:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});
router.get("/recentGroup", async (req, res) => {
  const customerId = req.query.customerId || req.query.userId || null;
  const limit = Math.min(Number(req.query.limit || 10), 100);
  console.log("recentGroup");
  try {
    // 1) 최근 헤더 먼저
    const headerParams = [];
    let headerWhere = "1=1";
    if (customerId) {
      headerWhere += " AND h.customer_id = ?";
      headerParams.push(customerId);
    }

    const headers = await SQL.executeQuery(
      `SELECT  h.order_id   AS id, h.order_date AS order_date FROM JUNIL_ORDER_HEADER h
      WHERE ${headerWhere}
      ORDER BY h.order_date DESC, h.order_id DESC
      LIMIT ?
      `,
      [...headerParams, limit]
    );
    if (!headers.length) {
      return res.json({ ok: true, orders: [] });
    }
    // 2) 해당 헤더들의 디테일 한 번에
    const orderIds = headers.map((h) => h.id);
    const placeholders = orderIds.map(() => "?").join(",");
    const detailsRaw = await SQL.executeQuery(
      ` SELECT  d.order_id AS id, d.order_id, i.type,COALESCE(d.item_label, i.label) AS label,
        COALESCE(d.sub_label,  i.sub_label) AS sub_label,  COALESCE(d.unit,i.unit) AS unit, COALESCE(i.type, d.item_label) AS type,d.quantity,
        d.note ,d.status
      FROM JUNIL_ORDER_DETAIL d
      LEFT JOIN JUNIL_ITEMS i ON i.item_id = d.item_id
      WHERE d.order_id IN (${placeholders})
      ORDER BY d.order_id DESC, d.order_id ASC
      `,
      orderIds
    );

    // 3) Buffer → string 정규화

    const details = detailsRaw.map(normalizeRow);

    // 4) JS에서 주문 단위로 그룹화
    const map = new Map();
    headers.forEach((h) => {
      map.set(h.id, {
        id: h.id,
        date: formatMMDD(h.order_date),
        // status: h.status || "PENDING",
        items: [],
      });
    });

    details.forEach((d) => {
      const group = map.get(d.order_id);
      if (group) {
        group.items.push({
          id: d.id,
          type: d.type,
          label: d.label,
          sub_label: d.sub_label || null,
          unit: d.unit,
          quantity: Number(d.quantity),
          note: d.note || null,
          status:d.status 
        });
      }
    });

    // 5) 정렬 유지한 배열로 변환
    const orders = headers.map((h) => map.get(h.id));
    console.log("orders", orders);
    res.json({ ok: true, orders });
  } catch (e) {
    console.error("/api/orders/recent(grouped) error:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.get("/recent", async (req, res) => {
  try {
    const customerId = req.query.customerId || req.query.userId || null;
    const limit = Math.min(Number(req.query.limit || 20), 100);

    const params = [];
    let where = "1=1";
    if (customerId) {
      where += " AND h.customer_id = ? ";
      params.push(customerId);
    }
    const query = ` SELECT 
         d.order_id AS id,
         DATE_FORMAT(h.order_date, '%m/%d') AS date,    -- "10/27" 형식
         COALESCE(i.type, d.item_label) AS type,         -- d에 스냅샷이 없으면 아이템 마스터 타입
         COALESCE(d.item_label, i.label) AS label,
         d.quantity,
         COALESCE(d.unit, i.unit) AS unit,
         h.status
    FROM JUNIL_ORDER_DETAIL d JOIN JUNIL_ORDER_HEADER h ON h.order_id = d.order_id
    LEFT JOIN JUNIL_ITEMS i ON i.item_id = d.item_id
    WHERE ${where}
    ORDER BY h.order_date DESC, d.order_id DESC LIMIT ?
    `;
    const value = [...params, limit];
    const rows = await SQL.executeQuery(query, value);
    res.json({ ok: true, orders: rows });
  } catch (e) {
    console.error("/api/orders/recent error:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

/**
 * GET /api/orders/stats?customerId=123
 * 이달 건수 + 마지막 발주일
 */
router.get("/stats", async (req, res) => {
  try {
    const customerId = req.query.customerId || req.query.userId || null;
    const params = [];
    let where = "1=1";
    if (customerId) {
      where += " AND customer_id = ?";
      params.push(customerId);
    }

    const [monthRow] = await SQL.executeQuery(
      `
      SELECT COUNT(*) AS monthCount
      FROM JUNIL_ORDER_HEADER
      WHERE ${where}
        AND DATE_FORMAT(order_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
      `,
      params
    );

    const [lastRow] = await SQL.executeQuery(
      `
      SELECT DATE_FORMAT(MAX(order_date), '%Y-%m-%d') AS lastOrderAt
      FROM JUNIL_ORDER_HEADER
      WHERE ${where}
      `,
      params
    );

    res.json({
      ok: true,
      monthCount: monthRow?.monthCount ?? 0,
      lastOrderAt: lastRow?.lastOrderAt || "-",
    });
  } catch (e) {
    console.error("/api/orders/stats error:", e);
    res.status(500).json({ ok: false, message: e.message });
  }
});

// 목록: 헤더 + 고객명 + 품목수 + 합계
router.get("/", async (req, res) => {
  try {
    const [rows] = await SQL.db.query(`
      SELECT
        h.order_id,
        h.customer_id,
        c.name AS customer_name,
        h.phone_number,
        h.order_date,
        h.status,
        h.total_qty,
        h.total_amount,
        h.created_at,
        h.updated_at,
        COUNT(d.detail_id) AS item_count
      FROM JUNIL_ORDER_HEADER h
      LEFT JOIN JUNIL_CUSTOMERS c ON c.customer_id = h.customer_id
      LEFT JOIN JUNIL_ORDER_DETAIL d ON d.order_id = h.order_id
      GROUP BY h.order_id
      ORDER BY h.created_at DESC
    `);
    res.json({ ok: true, orders: rows });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// 단건 조회: 헤더 + 디테일
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [[header]] = await SQL.db.query(
      `SELECT h.*, c.name AS customer_name
       FROM JUNIL_ORDER_HEADER h
       LEFT JOIN JUNIL_CUSTOMERS c ON c.customer_id = h.customer_id
       WHERE h.order_id=? LIMIT 1`,
      [id]
    );
    const [details] = await SQL.db.query(
      `SELECT detail_id, item_id, item_label, sub_label, unit, quantity, price, amount, note
       FROM JUNIL_ORDER_DETAIL WHERE order_id=? ORDER BY detail_id ASC`,
      [id]
    );
    res.json({ ok: true, header, details });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// 삭제(헤더 삭제 시 디테일은 FK ON DELETE CASCADE 가정)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await SQL.db.query(`DELETE FROM JUNIL_ORDER_HEADER WHERE order_id=?`, [id]);
    res.json({ ok: true, message: "삭제 완료" });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// 복제: 헤더/디테일 트랜잭션 복제 + 합계 재계산
router.post("/:id/clone", async (req, res) => {
  const { id } = req.params;
  const conn = await SQL.db.getConnection();
  try {
    await conn.beginTransaction();

    const [[h]] = await conn.query(`SELECT * FROM JUNIL_ORDER_HEADER WHERE order_id=? LIMIT 1`, [id]);
    if (!h) throw new Error("원본 주문을 찾을 수 없습니다.");

    const [dRows] = await conn.query(`SELECT * FROM JUNIL_ORDER_DETAIL WHERE order_id=?`, [id]);

    const [nh] = await conn.query(
      `INSERT INTO JUNIL_ORDER_HEADER
       (customer_id, phone_number, order_date, memo, status, total_amount, total_qty, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'NEW', 0, 0, NOW(), NOW())`,
      [h.customer_id || null, h.phone_number || "", h.order_date, h.memo || ""]
    );
    const newOrderId = nh.insertId;

    let totalQty = 0;
    let totalAmount = 0;

    for (const d of dRows) {
      const qty = Number(d.quantity || 0);
      const price = d.price ?? null;
      const amount = d.amount ?? (price != null ? Number(price) * qty : null);

      await conn.query(
        `INSERT INTO JUNIL_ORDER_DETAIL
         (order_id, item_id, item_label, sub_label, unit, quantity, price, amount, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newOrderId, d.item_id || null, d.item_label, d.sub_label || null, d.unit, qty, price, amount, d.note || null]
      );

      totalQty += qty;
      if (amount != null) totalAmount += amount;
    }

    await conn.query(`UPDATE JUNIL_ORDER_HEADER SET total_qty=?, total_amount=?, updated_at=NOW() WHERE order_id=?`, [
      totalQty,
      totalAmount,
      newOrderId,
    ]);

    await conn.commit();
    res.json({ ok: true, new_order_id: newOrderId, total_qty: totalQty, total_amount: totalAmount });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ ok: false, message: e.message });
  } finally {
    conn.release();
  }
});

export default router;
