// routes/orders-customer-summary.js
import express from "express";
import SQL from "../sql.js";

const router = express.Router();

/**
 * GET /api/orders/customer-summary
 * query: customer_id (required), dateFrom, dateTo, status (optional), includeSub(=1) optional
 * 결과: label, unit (+ sub_label=옵션), quantity, amount, orders
 */
router.get("/", async (req, res) => {
  console.log("customer-summary(all/one)");
  const { customerId, dateFrom, dateTo, status, includeSub } = req.query;

  const params = [];
  let where = "WHERE 1=1";

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
    where += " AND h.status = ?";
    params.push(status);
  }

  // 정규화(공백/빈값 처리)
  const labelExpr = "TRIM(d.item_label)";
  const unitExpr = "TRIM(COALESCE(d.unit, ''))";
  const subExprRaw = "NULLIF(TRIM(COALESCE(d.sub_label, '')), '')";
  const subExpr = includeSub ? subExprRaw : "NULL";

  // 금액(명시된 amount 없으면 price*quantity)
  const amtExpr = "COALESCE(d.amount, d.price * d.quantity)";

  // SELECT / GROUP BY 컬럼 구성
  const selectCols = `
    h.customer_id,
    MIN(h.customer_name) AS customer_name,
    ${labelExpr} AS item_label,
    ${subExpr} AS sub_label,
    ${unitExpr}  AS unit
  `;

  const groupCols = `
    h.customer_id,
    ${labelExpr},
    ${includeSub ? subExprRaw + "," : ""}
    ${unitExpr}
  `;

  const sql = `
    SELECT
      ${selectCols},
      CAST(SUM(d.quantity) AS DECIMAL(18,3)) AS total_qty,
      CAST(SUM(${amtExpr}) AS DECIMAL(18,0)) AS total_amount,
      COUNT(DISTINCT d.order_id) AS orders
    FROM JUNIL_ORDER_DETAIL d
    JOIN JUNIL_ORDER_HEADER h ON d.order_id = h.order_id
    ${where}
    GROUP BY ${groupCols}
    ORDER BY h.customer_id, total_amount DESC, total_qty DESC;
  `;

  try {
    const rows = await SQL.executeQuery(sql, params);

    if (!customerId) {
      // ✅ 전체 거래처: { customer_id, customer_name, items: [...] }로 묶어서 반환
      const grouped = new Map();
      for (const r of rows) {
        const key = String(r.customer_id);
        if (!grouped.has(key)) {
          grouped.set(key, {
            customer_id: r.customer_id,
            customer_name: r.customer_name, // ✅ 거래처명 포함
            items: [],
          });
        }
        grouped.get(key).items.push({
          label: r.item_label,
          sub_label: r.sub_label,
          unit: r.unit,
          total_qty: r.total_qty,
          total_amount: r.total_amount,
          orders: r.orders,
        });
      }
      res.json(Array.from(grouped.values()));
    } else {
      // ✅ 단일 거래처: 거래처명도 같이 리턴(프론트에서 필요하면 그대로 사용)
      res.json(
        rows.map((r) => ({
          customer_id: r.customer_id,
          customer_name: r.customer_name, // ✅ 거래처명 포함
          label: r.item_label,
          sub_label: r.sub_label,
          unit: r.unit,
          total_qty: r.total_qty,
          total_amount: r.total_amount,
          orders: r.orders,
        }))
      );
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch customer summary" });
  }
});

export default router;
