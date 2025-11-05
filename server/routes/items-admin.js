// routes/items-admin.js
import express from "express";
import SQL from "../sql.js";

const router = express.Router();

// 목록: GET /api/admin/items?type=&q=
router.get("/", async (req, res) => {
  try {
    const { type, q } = req.query;
    const where = [];
    const args = [];

    if (type) {
      where.push("type = ?");
      args.push(type);
    }
    if (q) {
      where.push("(label LIKE ? OR sub_label LIKE ?)");
      args.push(`%${q}%`, `%${q}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT item_id, type, label, unit, IFNULL(sub_label,'')as sub_label
      FROM JUNIL_ITEMS
      ${whereSql}
      ORDER BY type, label, item_id
    `;
    const rows = await SQL.executeQuery(sql, args);
    res.json(rows);
  } catch (e) {
    console.error("items list error:", e);
    res.status(500).send("품목 목록 조회 실패");
  }
});

// 생성: POST /api/admin/items
router.post("/", async (req, res) => {
  try {
    const { type, label, unit, sub_label } = req.body || {};
    if (!type || !label || !unit) return res.status(400).send("구분/품목/단위는 필수입니다.");

    const sql = `
      INSERT INTO JUNIL_ITEMS (type, label, unit, sub_label)
      VALUES (?, ?, ?, ?)
    `;
    const r = await SQL.executeQuery(sql, [type, label, unit, sub_label || null]);
    res.status(201).json({ ok: true, item_id: r.insertId });
  } catch (e) {
    console.error("item create error:", e);
    res.status(500).send("품목 등록 실패");
  }
});

// 수정: PUT /api/admin/items/:id
router.put("/:id", async (req, res) => {
  try {
    const { type, label, unit, sub_label } = req.body || {};
    const id = req.params.id;
    if (!type || !label || !unit) return res.status(400).send("구분/품목/단위는 필수입니다.");

    const sql = `
      UPDATE JUNIL_ITEMS
      SET type = ?, label = ?, unit = ?, sub_label = ?
      WHERE item_id = ?
    `;
    const r = await SQL.executeQuery(sql, [type, label, unit, sub_label || null, id]);
    if (r.affectedRows === 0) return res.status(404).send("대상 품목이 없습니다.");
    res.json({ ok: true });
  } catch (e) {
    console.error("item update error:", e);
    res.status(500).send("품목 수정 실패");
  }
});

// 삭제: DELETE /api/admin/items/:id  (거래 사용 여부 체크)
router.delete("/:id", async (req, res) => {
  const conn = await SQL.db.getConnection();
  try {
    const id = req.params.id;

    // 1) 거래 사용 여부 확인
    const [usedRows] = await conn.query(`SELECT COUNT(*) AS cnt FROM JUNIL_ORDER_DETAIL WHERE item_id = ?`, [id]);
    console.log(usedRows);
    const used = usedRows?.[0]?.cnt || 0;
    if (used > 0) {
      return res.status(409).send("해당 품목은 거래내역에 사용되어 삭제할 수 없습니다.");
    }

    // 2) 삭제
    const [r] = await conn.query(`DELETE FROM JUNIL_ITEMS WHERE item_id = ?`, [id]);
    if (r.affectedRows === 0) return res.status(404).send("대상 품목이 없습니다.");

    res.json({ ok: true });
  } catch (e) {
    console.error("item delete error:", e);
    res.status(500).send("품목 삭제 실패");
  } finally {
    try {
      conn.release();
    } catch {}
  }
});

export default router;
