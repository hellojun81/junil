import express from "express";
import SQL from "../sql.js";

const router = express.Router();

// 값 파싱 유틸
const parseSettingsRows = (rows) => {
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  let units = [];
  try { units = map.units_json ? JSON.parse(map.units_json) : []; } catch {}
  return {
    company_name: map.company_name || "",
    default_unit: map.default_unit || (units[0] || "KG"),
    dashboard_rows: map.dashboard_rows ? Number(map.dashboard_rows) : 10,
    units, // ["KG","BOX","EA"]
  };
};

// GET /api/settings  → 모든 설정 반환
router.get("/", async (req, res) => {
  try {
    const rows = await SQL.executeQuery(
      "SELECT `key`,`value` FROM JUNIL_SETTINGS WHERE `key` IN ('company_name','default_unit','dashboard_rows','units_json')"
    );
    res.json(parseSettingsRows(rows));
  } catch (e) {
    console.error("GET /settings error:", e);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

// PUT /api/settings  → 설정 저장(업서트)
// body: { company_name, default_unit, dashboard_rows, units? (["KG","BOX"]) }
router.put("/", async (req, res) => {
  const { company_name = "", default_unit, dashboard_rows, units } = req.body || {};

  // 유효성
  if (!default_unit) return res.status(400).json({ error: "default_unit is required" });
  if (!Number.isFinite(Number(dashboard_rows))) return res.status(400).json({ error: "dashboard_rows invalid" });

  // units가 오면 JSON으로 함께 저장(콤마 입력을 프론트에서 배열로 변환)
  let unitsArr = Array.isArray(units) ? units : undefined;
  if (unitsArr) {
    unitsArr = Array.from(new Set(
      unitsArr.map(s => String(s).trim()).filter(Boolean)
    ));
    if (!unitsArr.includes(default_unit)) {
      unitsArr.unshift(default_unit); // 기본단위는 목록에 강제 포함
    }
  }

  const conn = await SQL.db.getConnection();
  try {
    await conn.beginTransaction();

    const upsert = async (k, v) => {
      await conn.query(
        "INSERT INTO JUNIL_SETTINGS (`key`,`value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)",
        [k, String(v)]
      );
    };

    await upsert("company_name", company_name);
    await upsert("default_unit", default_unit);
    await upsert("dashboard_rows", Number(dashboard_rows));
    if (unitsArr) {
      await upsert("units_json", JSON.stringify(unitsArr));
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error("PUT /settings error:", e);
    res.status(500).json({ error: "Failed to save settings" });
  } finally {
    conn.release();
  }
});

export default router;
