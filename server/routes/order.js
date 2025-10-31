import express from "express";
import dayjs from "dayjs";
import SQL from "../sql.js";

const router = express.Router();

/**
 * 기존/신규 품목 확보:
 * - 동일 (type,label) 이 있으면 반환
 * - sub_label이 새 값이면 콤마로 병합 업데이트
 * - 없으면 생성
 * - 단가/단위는 기존값 유지, 신규 생성 시 전달값 사용
 */
async function getOrCreateItem(conn, { type, label, unit, subLabel, price }) {
  const query = `SELECT item_id, unit, price, sub_label FROM JUNIL_ITEMS WHERE type=? AND label=? LIMIT 1`;
  const value = [type, label];
  const result = await SQL.executeQuery(query, value);

  if (result.length) {
    const item = result[0];
    if (subLabel) {
      const cur = (item.sub_label || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const want = subLabel
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const merged = Array.from(new Set([...cur, ...want])).join(",");
      if (merged !== (item.sub_label || "")) {
        await SQL.executeQuery(`UPDATE JUNIL_ITEMS SET sub_label=?, updated_at=NOW() WHERE item_id=?`, [merged, item.item_id]);
      }
    }
    return { item_id: item.item_id, unit: item.unit, price: item.price };
  }

  const ins = await SQL.executeQuery(
    `INSERT INTO JUNIL_ITEMS (type, label, sub_label, unit, price, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
    [type, label, subLabel || null, unit || "KG", price ?? null]
  );
  return { item_id: ins.insertId, unit: unit || "KG", price: price ?? null };
}

async function findCustomerPhone(conn, customerId) {
  if (!customerId) return null;
  const rows = await SQL.executeQuery(`SELECT phone_number FROM JUNIL_CUSTOMERS WHERE customer_id=? LIMIT 1`, [customerId]);
  return rows[0]?.phone_number || null;
}

/**
 * 요청 바디 예시:
 * {
 *   customerId: 1,
 *   orderDate: "2025-10-30",
 *   memo: "아침 배송",
 *   items: [
 *     { type:"소", label:"등심", subLabel:null, unit:"KG", quantity:5, price:18000, note:"두께 굵게" },
 *     { type:"돼지", label:"갈매기", subLabel:"토시O", unit:"KG", quantity:3, price:12000 }
 *   ]
 * }
 */
router.post("/", async (req, res) => {
  const { customerId, orderDate, items, memo } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, message: "items가 비어있습니다." });
  }
  console.log(customerId, orderDate, items, memo);
  const conn = await SQL.db.getConnection();
  try {
    await conn.beginTransaction();

    const phone = (await findCustomerPhone(conn, customerId)) || req.body.phoneNumber || "";
    const date = orderDate || dayjs().format("YYYY-MM-DD");

    // 1) 헤더 생성(초깃값 0)
    const h = await SQL.executeQuery(
      `INSERT INTO JUNIL_ORDER_HEADER
       (customer_id, phone_number, order_date, memo, status, total_amount, total_qty, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'NEW', 0, 0, NOW(), NOW())`,
      [customerId || null, phone, date, memo || ""]
    );
    const orderId = h.insertId;

    // 2) 디테일 & 합계 계산
    let totalQty = 0;
    let totalAmount = 0;

    const toNumOrNull = (v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    // 0을 기본값으로 쓰고 싶을 때(수량 등)는 별도
    const toNumOrZero = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    for (const it of items) {
      const qty = toNumOrZero(it.quantity);
      if (!it.label || !it.type || qty <= 0) {
        throw new Error("각 품목은 type, label, quantity(>0)가 필요합니다.");
      }

      const { item_id, price: itemPriceFromDB } = await getOrCreateItem(conn, {
        type: it.type,
        label: it.label,
        unit: it.unit,
        subLabel: it.subLabel,
        price: it.price,
      });
      console.log("it.price", it.price);
      const price = toNumOrNull(it.price ?? itemPriceFromDB);
      const amount = price != null ? Number(price) * qty : null;
      console.log(orderId, item_id || null, it.label, it.subItem || null, it.unit || "KG", qty, price || 0, amount, it.note || null);
      await SQL.executeQuery(
        `INSERT INTO JUNIL_ORDER_DETAIL
         (order_id, item_id, item_label, sub_label, unit, quantity, price, amount, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item_id || null, it.label, it.subItem || null, it.unit || "KG", qty, price || 0, amount, it.note || null]
      );

      totalQty += qty;
      if (amount != null) totalAmount += amount;
    }

    // 3) 헤더 합계 업데이트
    // await conn.query(`UPDATE JUNIL_ORDER_HEADER SET total_qty=?, total_amount=?, updated_at=NOW() WHERE order_id=?`, [
    //   totalQty,
    //   totalAmount,
    //   orderId,
    // ]);

    // await conn.commit();
    res.json({ ok: true, order_id: orderId, total_qty: totalQty, total_amount: totalAmount });
  } catch (e) {
    await conn.rollback();
    console.error("POST /api/orders error:", e);
    res.status(500).json({ ok: false, message: e.message });
  } finally {
    conn.release();
  }
});

export default router;
