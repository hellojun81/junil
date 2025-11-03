import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import "dotenv/config"; // 💡 dotenv를 import하는 표준 ES 모듈 방식
import orders from "./routes/order.js";
import ordersExtra from "./routes/orders-extra.js";
import ordersStats from "./routes/orders-stats.js";
import ordersAdmin from "./routes/orders-admin.js";
import itemsAdmin from "./routes/items-admin.js";
import customersAdmin from "./routes/customers-admin.js";
import SQL from "./sql.js";
import ordersCustomerSummary from "./routes/orders-customer-summary.js";

// 참고: 만약 sql.js가 여전히 CommonJS라면 require('./sql.js')를 사용해야 합니다.
// 여기서는 일관성을 위해 sql.js도 ES 모듈로 가정합니다.

const app = express();
const PORT = 3001;
// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json());
console.log({ "process.env.DB_HOST": process.env.DB_USER });

app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());
app.use("/api/orders", orders);
app.use("/api/orders/extra", ordersExtra);
app.use("/api/orders/stats", ordersStats);
app.use("/api/orders", ordersAdmin); // 기존 orders, orders-extra, orders-stats와 함께 사용
app.use("/api/admin/items", itemsAdmin);
app.use("/api/admin/customers", customersAdmin);
app.use("/api/orders/customer-summary", ordersCustomerSummary);
app.use("/icons", express.static("icons"));
app.get("/api/items", async (req, res) => {
  try {
    console.log("/api/items");
    const query = `SELECT item_id, type, label, sub_label ,unit FROM JUNIL_ITEMS ORDER BY type, label`;
    const result = await SQL.executeQuery(query);
    const items = result.map((item) => {
      const rawSubItems = item.sub_label;

      // 1. subItemsArray 계산 (null, undefined, 빈 문자열, 문자열이 아닌 경우 안전하게 처리)
      let subItemsArray =
        rawSubItems && typeof rawSubItems === "string" && rawSubItems.trim().length > 0 ? rawSubItems.split(",").map((s) => s.trim()) : null;

      // 2. 💡 추가된 로직: 배열에 'null' 또는 공백 문자열만 있는 경우 필터링
      if (subItemsArray) {
        // 빈 문자열 또는 'null' 문자열 항목을 제거
        subItemsArray = subItemsArray.filter((s) => s.trim() !== "" && s.toLowerCase() !== "null");

        // 필터링 후 배열이 비어 있으면 null로 설정하여 필드를 제거하도록 준비
        if (subItemsArray.length === 0) {
          subItemsArray = null;
        }
      }

      // 3. 반환 객체 생성
      const baseItem = {
        type: item.type,
        label: item.label,
        value: item.item_id,
        unit: item.unit,
      };
      // 4. subItemsArray가 null이 아니면 속성을 추가 (null이면 아예 제외)
      if (subItemsArray) {
        baseItem.subItems = subItemsArray;
      }
      console.log(baseItem);
      return baseItem; // null이면 subItems 필드가 아예 포함되지 않음
    });

    res.status(200).json(items);
  } catch (error) {
    // ... (오류 처리 유지)
    console.log(`error.code${error}`);
  }
});
// ...
// 발주 접수 API (기존 코드 유지)
app.post("/api/orders", (req, res) => {
  const phoneNumber = req.header("X-Phone-Number");
  const { userId, orders } = req.body;

  if (!userId || !orders || orders.length === 0) {
    return res.status(400).json({ success: false, message: "유효한 발주 정보가 필요합니다." });
  }

  ordersStats;
  // 성공 응답 반환
  res.json({ success: true, message: "발주서가 성공적으로 접수되었습니다." });
});
// 거래처 목록 조회
app.get("/api/customers", async (req, res) => {
  try {
    const query = `SELECT customer_id, phone_number, name, contact_person, address, note_internal, note_delivery, created_at 
             FROM JUNIL_CUSTOMERS 
             ORDER BY created_at DESC`;

    const result = await SQL.executeQuery(query);
    res.status(200).json(result);
  } catch (error) {
    console.error("거래처 조회 오류:", error);
    res.status(500).json({ message: "거래처 데이터를 불러오는 데 실패했습니다." });
  }
});

// 새로운 거래처 생성
app.post("/api/customers", async (req, res) => {
  const { phone_number, name, contact_person, address, note_internal, note_delivery } = req.body;
  try {
    const query = `INSERT INTO JUNIL_CUSTOMERS (phone_number, name, contact_person, address, note_internal, note_delivery) 
             VALUES (?, ?, ?, ?, ?, ?)`;
    const value = [phone_number, name, contact_person, address, note_internal, note_delivery];
    const result = SQL.executeQuery(query, value);
    res.status(201).json({ message: "거래처가 성공적으로 등록되었습니다.", id: result.insertId });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "이미 존재하는 전화번호입니다." });
    }
    console.error("거래처 등록 오류:", error);
    res.status(500).json({ message: "거래처 등록에 실패했습니다." });
  }
});

// 거래처 정보 수정 (전화번호 기준)
app.put("/api/customers/:phone_number", async (req, res) => {
  const oldPhoneNumber = req.params.phone_number;
  const { phone_number, name, contact_person, address, note_internal, note_delivery } = req.body;
  try {
    const query = `UPDATE JUNIL_CUSTOMERS 
             SET phone_number = ?, name = ?, contact_person = ?, address = ?, note_internal = ?, note_delivery = ?
             WHERE phone_number = ?`;
    const value = [phone_number, name, contact_person, address, note_internal, note_delivery, oldPhoneNumber];
    const result = SQL.executeQuery(query, value);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "해당 거래처를 찾을 수 없습니다." });
    }
    res.status(200).json({ message: "거래처 정보가 성공적으로 수정되었습니다." });
  } catch (error) {
    console.error("거래처 수정 오류:", error);
    res.status(500).json({ message: "거래처 정보 수정에 실패했습니다." });
  }
});

// 거래처 삭제 (전화번호 기준)
app.delete("/api/customers/:phone_number", async (req, res) => {
  const phoneNumber = req.params.phone_number;
  try {
    const query = "DELETE FROM JUNIL_CUSTOMERS WHERE phone_number = ?";
    const value = [phoneNumber];
    const result = SQL.executeQuery(query, value);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "해당 거래처를 찾을 수 없습니다." });
    }
    res.status(200).json({ message: "거래처가 성공적으로 삭제되었습니다." });
  } catch (error) {
    console.error("거래처 삭제 오류:", error);
    res.status(500).json({ message: "거래처 삭제에 실패했습니다." });
  }
});

// =========================================================
// 2. 품목 관리 API (/api/management/items)
// =========================================================

// 품목 목록 조회 (관리용)
app.get("/api/management/items", async (req, res) => {
  try {
    // sub_items는 콤마 구분 문자열 그대로 반환 (관리 화면에서 편집 용이하도록)
    const query = `SELECT item_id, type, label, unit, sub_label
             FROM JUNIL_ITEMS 
             ORDER BY type, item_id`;
    console.log(result);
    const result = await SQL.executeQuery(query);
    res.status(200).json(result);
    2;
  } catch (error) {
    console.error("품목 관리 조회 오류:", error);
    res.status(500).json({ message: "품목 데이터를 불러오는 데 실패했습니다." });
  }
});

// 새로운 품목 생성
app.post("/api/management/items", async (req, res) => {
  const { type, label, value, sub_items } = req.body;
  try {
    const query = `INSERT INTO JUNIL_ITEMS (type, label, value, sub_items) 
             VALUES (?, ?, ?, ?)`;
    const value = [type, label, value, sub_items || null];
    const result = SQL.executeQuery(query, value);
    res.status(201).json({ message: "품목이 성공적으로 등록되었습니다.", id: result.insertId });
  } catch (error) {
    console.error("품목 등록 오류:", error);
    res.status(500).json({ message: "품목 등록에 실패했습니다." });
  }
});

// 품목 정보 수정 (item_id 기준)
app.put("/api/management/items/:id", async (req, res) => {
  const itemId = req.params.id;
  const { type, label, value, sub_items } = req.body;
  try {
    constquery = `UPDATE JUNIL_ITEMS 
             SET type = ?, label = ?, value = ?, sub_items = ?
             WHERE item_id = ?`;
    const value = [type, label, value, sub_items || null, itemId];
    const result = SQL.executeQuery(query, value);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "해당 품목을 찾을 수 없습니다." });
    }
    res.status(200).json({ message: "품목 정보가 성공적으로 수정되었습니다." });
  } catch (error) {
    console.error("품목 수정 오류:", error);
    res.status(500).json({ message: "품목 정보 수정에 실패했습니다." });
  }
});

// 품목 삭제 (item_id 기준)
app.delete("/api/management/items/:id", async (req, res) => {
  const itemId = req.params.id;
  try {
    const query = "DELETE FROM JUNIL_ITEMS WHERE item_id = ?";
    const value = [itemId];
    const result = SQL.executeQuery(query, value);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "해당 품목을 찾을 수 없습니다." });
    }
    res.status(200).json({ message: "품목이 성공적으로 삭제되었습니다." });
  } catch (error) {
    console.error("품목 삭제 오류:", error);
    res.status(500).json({ message: "품목 삭제에 실패했습니다." });
  }
});

app.post("/api/login", async (req, res) => {
  const { phoneNumber } = req.body;
  console.log(phoneNumber);
  if (!phoneNumber) {
    return res.status(400).json({ success: false, message: "전화번호를 입력해주세요." });
  }

  let user = null;
  try {
    // 실제 DB 조회 쿼리 실행
    // 'loginKind' 필드는 클라이언트(0)와 관리자(1)를 구분하는 필드라고 가정합니다.
    const query = "SELECT customer_id, name, phone_number, login_Kind FROM JUNIL_CUSTOMERS WHERE phone_number = ?";
    const value = [phoneNumber];
    const result = await SQL.executeQuery(query, value);

    console.log(result);
    user = result[0]; // 조회 결과의 첫 번째 행

    if (user) {
      console.log(`[로그인 성공] 사용자: ${user.name}, 유형: ${user.login_Kind}`);

      // 로그인 성공 시 사용자 정보를 클라이언트에 반환
      return res.json({
        success: true,
        user: {
          customer_id: user.customer_id,
          name: user.name,
          phone_number: user.phone_number,
          login_Kind: user.login_Kind, // 클라이언트 앱에서 메뉴 분기에 사용됨
        },
      });
    } else {
      console.log(`[로그인 실패] 전화번호: ${phoneNumber}`);
      return res.status(401).json({ success: false, message: "등록되지 않은 전화번호입니다." });
    }
  } catch (error) {
    console.error("DB Error during login:", error);
    return res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
