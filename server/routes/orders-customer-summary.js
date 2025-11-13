// routes/orders-customer-summary.js
import express from "express";
import SQL from "../sql.js";

const router = express.Router();

/**
 * GET /api/orders/customer-summary
 * query: customer_id (required), dateFrom, dateTo, status (optional), includeSub(=1) optional
 * 결과: label, unit (+ sub_label=옵션), quantity, amount, orders
 */
// GET /api/customer-summary
router.get("/", async (req, res) => {
  console.log("customer-summary");
  const { customerId, dateFrom, dateTo, status, includeSub } = req.query;

  const params = [];
  let where = "WHERE 1=1";

  // 선택적 필터
  if (customerId) {
    where += " AND h.customer_id = ?";
    params.push(customerId);
  }
  if (dateFrom) {
    where += " AND h.order_date >= ?";
    params.push(dateFrom);
  }
  if (dateTo) {
    where += " AND h.order_date <= ?";
    params.push(dateTo);
  }
  if (status) {
    // JUNIL_ORDER_HEADER.status 값을 그대로 사용 (예: NEW / PENDING / DELIVERED / CANCELLED 등)
    where += " AND h.status = ?";
    params.push(status);
  }

  // ====== 정규화 & 집계 컬럼 ======
  // 같은 품목 합산을 위한 TRIM/NULLIF
  const labelExpr  = "TRIM(d.item_label)";
  const unitExpr   = "TRIM(COALESCE(d.unit, ''))";
  const subExprRaw = "NULLIF(d.sub_label, '')";
  const subExpr    = includeSub ? subExprRaw : "";
  console.log('subExpr',subExpr)
  // amount 없으면 price*quantity 사용
  const amtExpr = "COALESCE(d.amount, d.price * d.quantity)";

  // SELECT / GROUP BY
  const selectCols = `c.customer_id, MIN(c.name) AS customer_name, ${labelExpr} AS item_label,
    IFNULL(d.sub_label, '')  AS sub_label,
    ${unitExpr}  AS unit
  `;
  const groupCols = `
    c.customer_id,
    ${labelExpr},
    ${includeSub ? `${subExprRaw},` : ""}
    ${unitExpr}
  `;

  const sql = `SELECT i.type AS type, ${selectCols},CAST(SUM(d.quantity) AS DECIMAL(18,3)) AS total_qty,CAST(SUM(${amtExpr}) AS DECIMAL(18,0)) AS total_amount,
      COUNT(DISTINCT d.order_id) AS orders,d.status FROM JUNIL_ORDER_DETAIL d JOIN JUNIL_ORDER_HEADER h  ON d.order_id = h.order_id
    JOIN JUNIL_CUSTOMERS   c  ON h.customer_id = c.customer_id  LEFT JOIN JUNIL_ITEMS i ON d.item_id = i.item_id    ${where}
    GROUP BY   i.type,   ${groupCols}
    ORDER BY c.customer_id, total_amount DESC, total_qty DESC
  `;

  try {
    const rows = await SQL.executeQuery(sql, params);

    if (!customerId) {
      // 전체 거래처 묶어서 반환: [{customer_id, customer_name, items:[...]}]
      const byCustomer = new Map();
      for (const r of rows) {
        const key = String(r.customer_id);
        if (!byCustomer.has(key)) {
          byCustomer.set(key, {
            customer_id: r.customer_id,
            customer_name: r.customer_name,
            items: [],
          });
        }
        byCustomer.get(key).items.push({
          type:r.type,
          label: r.item_label,
          sub_label: r.sub_label, // includeSub=false이면 null로 고정됨
          unit: r.unit,
          total_qty: r.total_qty,
          total_amount: r.total_amount,
          orders: r.orders,
          status:r.status
        });
      }
      res.json(Array.from(byCustomer.values()));
    } else {
      // 단일 거래처: 품목 집계 리스트 (거래처 정보 포함)
      res.json(
        rows.map((r) => ({
          customer_id: r.customer_id,
          customer_name: r.customer_name,
          label: r.item_label,
          sub_label: r.sub_label,
          unit: r.unit,
          total_qty: r.total_qty,
          total_amount: r.total_amount,
          orders: r.orders,
          status:r.status
        }))
      );
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch customer summary" });
  }
});


export default router;
