// routes/customers-admin.js
import express from "express";
import SQL from "../sql.js";

const router = express.Router();

// 안전한 enum 기본값 (DB enum 값과 일치시켜 주세요)
const DEFAULT_LOGIN_KIND = "CUSTOMER"; // 'ADMIN' | 'CUSTOMER' 등
const DEFAULT_STATUS = "ACTIVE"; // 'ACTIVE' | 'INACTIVE' 등

// 유틸: 페이지 파라미터
function parsePaging(q) {
  const page = Math.max(parseInt(q.page ?? "1", 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(q.pageSize ?? "20", 10) || 20, 1), 200);
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
}

// ===============================
// 목록: GET /api/admin/customers
// ?q=&page=&pageSize=
// q는 name / phone_number / contact_person / address / email / label에 LIKE 검색
// ===============================
router.get("/", async (req, res) => {
  try {
    const { q = "" } = req.query;
    const { page, pageSize, offset, limit } = parsePaging(req.query);

    const like = `%${q}%`;
    const where = q ? `WHERE (name LIKE ? OR phone_number LIKE ? OR contact_person LIKE ? OR address LIKE ? OR email LIKE ? OR label LIKE ?)` : "";

    const args = q ? [like, like, like, like, like, like] : [];

    const rows = await SQL.executeQuery(
      `SELECT SQL_CALC_FOUND_ROWS
         customer_id, phone_number, email, name, label,
         contact_person, address, login_kind, status,
         created_at, updated_at
       FROM JUNIL_CUSTOMERS
       ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...args, limit, offset]
    );

    const [[{ "FOUND_ROWS()": total }]] = await SQL.db.query(`SELECT FOUND_ROWS()`);
    console.log(rows);
    res.json({ list: rows, total, page, pageSize });
  } catch (err) {
    console.error("GET /admin/customers error:", err);
    res.status(500).send("고객 목록 조회 실패");
  }
});

// ===============================
// 생성: POST /api/admin/customers
// body: { phone_number*, name*, email?, label?, contact_person?, address?, login_kind?, status? }
// phone_number, email은 UNIQUE (email은 NULL 허용)
// ===============================
router.post("/", async (req, res) => {
  try {
    const {
      phone_number,
      name,
      email = null,
      label = null,
      contact_person = null,
      address = null,
      login_kind = DEFAULT_LOGIN_KIND,
      status = DEFAULT_STATUS,
    } = req.body ?? {};

    if (!phone_number || !name) {
      return res.status(400).send("전화번호와 상호명은 필수입니다.");
    }

    // 중복 체크: phone_number
    {
      const [dup] = await SQL.db.query(`SELECT 1 FROM JUNIL_CUSTOMERS WHERE phone_number = ? LIMIT 1`, [phone_number]);
      if (dup.length) return res.status(409).send("이미 등록된 전화번호입니다.");
    }

    // 중복 체크: email (NULL 허용 / NULL은 중복체크 제외)
    if (email) {
      const [dupE] = await SQL.db.query(`SELECT 1 FROM JUNIL_CUSTOMERS WHERE email = ? LIMIT 1`, [email]);
      if (dupE.length) return res.status(409).send("이미 등록된 이메일입니다.");
    }

    const [r] = await SQL.db.query(
      `INSERT INTO JUNIL_CUSTOMERS
         (phone_number, email, name, label, contact_person, address, login_kind, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [phone_number, email, name, label, contact_person, address, login_kind, status]
    );

    res.status(201).json({ ok: true, customer_id: r.insertId });
  } catch (err) {
    console.error("POST /admin/customers error:", err);
    res.status(500).send("고객 등록 실패");
  }
});

// ===============================
// 수정: PUT /api/admin/customers/:phone
// URL 파라미터는 기존 phone_number (키로 사용)
// body는 생성과 동일 필드 (전화번호/이메일 변경 가능)
// ===============================
router.put("/:phone", async (req, res) => {
  const conn = await SQL.db.getConnection();
  try {
    const oldPhone = req.params.phone;

    const {
      phone_number, // 새 전화번호
      name,
      email = null,
      label = null,
      contact_person = null,
      address = null,
      login_kind = DEFAULT_LOGIN_KIND,
      status = DEFAULT_STATUS,
    } = req.body ?? {};

    if (!phone_number || !name) {
      return res.status(400).send("전화번호와 상호명은 필수입니다.");
    }

    // 기존 고객 조회
    const [curRows] = await conn.query(`SELECT customer_id, phone_number, email FROM JUNIL_CUSTOMERS WHERE phone_number = ? LIMIT 1`, [oldPhone]);
    if (!curRows.length) return res.status(404).send("대상 고객을 찾을 수 없습니다.");
    const current = curRows[0];

    // 전화번호 변경 시 중복 체크
    if (phone_number !== current.phone_number) {
      const [dup] = await conn.query(`SELECT 1 FROM JUNIL_CUSTOMERS WHERE phone_number = ? LIMIT 1`, [phone_number]);
      if (dup.length) return res.status(409).send("이미 등록된 전화번호입니다.");
    }

    // 이메일 변경 시 중복 체크 (NULL 허용)
    if (email && email !== current.email) {
      const [dupE] = await conn.query(`SELECT 1 FROM JUNIL_CUSTOMERS WHERE email = ? LIMIT 1`, [email]);
      if (dupE.length) return res.status(409).send("이미 등록된 이메일입니다.");
    }

    const [r] = await conn.query(
      `UPDATE JUNIL_CUSTOMERS
         SET phone_number = ?, email = ?, name = ?, label = ?, contact_person = ?, address = ?,
             login_kind = ?, status = ?, updated_at = NOW()
       WHERE customer_id = ?`,
      [phone_number, email, name, label, contact_person, address, login_kind, status, current.customer_id]
    );

    if (r.affectedRows === 0) return res.status(404).send("갱신 대상이 없습니다.");
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /admin/customers/:phone error:", err);
    res.status(500).send("고객 수정 실패");
  } finally {
    try {
      conn.release();
    } catch {}
  }
});

// ===============================
// 삭제: DELETE /api/admin/customers/:phone
// - 주문 헤더(JUNIL_ORDER_HEADER.customer_id) 참조 시 409
// ===============================
router.delete("/:phone", async (req, res) => {
  const conn = await SQL.db.getConnection();
  try {
    const phone = req.params.phone;

    const [rows] = await conn.query(`SELECT customer_id FROM JUNIL_CUSTOMERS WHERE phone_number = ? LIMIT 1`, [phone]);
    if (!rows.length) return res.status(404).send("대상 고객을 찾을 수 없습니다.");
    const { customer_id } = rows[0];

    // 참조 체크
    const [used] = await conn.query(`SELECT COUNT(*) AS cnt FROM JUNIL_ORDER_HEADER WHERE customer_id = ?`, [customer_id]);
    if (used[0].cnt > 0) {
      return res.status(409).send("거래내역이 존재하여 삭제할 수 없습니다.");
    }

    const [r] = await conn.query(`DELETE FROM JUNIL_CUSTOMERS WHERE customer_id = ?`, [customer_id]);
    if (r.affectedRows === 0) return res.status(404).send("삭제 대상이 없습니다.");

    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/customers/:phone error:", err);
    res.status(500).send("고객 삭제 실패");
  } finally {
    try {
      conn.release();
    } catch {}
  }
});

export default router;
