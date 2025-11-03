// QuickOrder.jsx
import React, { useState, useEffect, useMemo } from "react";
import Select, { components } from "react-select";
import {
  Button,
  Input,
  InputNumber,
  Typography,
  notification,
  Select as AntSelect,
  message
} from "antd";
import styled from "styled-components";
import { CheckCircleFilled } from "@ant-design/icons";
import { useCart } from "../context/CartContext"; // 선택적: CartProvider가 없는 경우 폴백
import {API_BASE_URL} from "../constants/config";
import { useUnit } from "../api/DefaultSetting"; // ✅ 추가
const { Text, Title } = Typography;

  // const { getUnit,default_unit} = getUnit();
const makeKey = (type, value, label) => `${type}::${value || label}`;

/* ================================
 *  Styled Components
 * ================================ */
const Container = styled.div`
  width: 100%;
  min-height: calc(100vh - 40px);
  max-height: 100vh;
  overflow-y: auto;
  padding: 24px;
  background: #fff;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
`;

const SelectContainer = styled.div`
  margin-bottom: 20px;
`;

/* ================================
 * Custom Option (react-select)
 *  - 추가된 품목이면 체크 아이콘 표시
 * ================================ */
const CustomOption = (props) => {
  const { innerProps, label, data, selectProps } = props;
  const addedList = selectProps?.addedItemValues || [];
  // const addedKeys = selectProps?.addedKeys || new Set(); // Set<string>


  const itemKey = makeKey(data.type, data.value, data.label);
  const isItemAdded = addedList.includes(data.value);

  const isCurrentlySelected =
    (selectProps?.value && selectProps.value.value === data.value) || false;

  const optionStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    padding: "12px 10px",
    fontSize: "16px",
    width: "100%",
    background: isCurrentlySelected ? "#f6ffed" : "white",
  };
 return (
    <components.Option {...props}>
      <div
        {...innerProps}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          padding: "12px 10px",
          fontSize: 16,
          width: "100%",
          background: isCurrentlySelected ? "#f6ffed" : "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
          <span style={{ flexGrow: 1, fontWeight: 600 }}>{label}</span>
          {isItemAdded && (
            <CheckCircleFilled style={{ color: "#3F8600", fontSize: 18, marginLeft: 10 }} />
          )}
        </div>
        {data.subItems?.length > 0 && (
          <Text type="secondary" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.2 }}>
            {/* {console.log(data.subItems)} */}
            세부 분류: {data.subItems.join(",")}
          </Text>
        )}
      </div>
    </components.Option>
  );

};

/* ================================
 * QuickOrder
 *  props:
 *    - meatType: "소" | "돼지" (필수)
 *    - onClose: () => void
 *    - initialOrder: { type, value, label, subItem, quantity, unit, note } (재발주 진입 시)
 *    - onAddItem: (item) => void   // CartContext 미사용 시 폴백
 *    - addedItems: []              // CartContext 미사용 시 폴백
 * ================================ */
const QuickOrder = ({
  meatType,
  onClose,
  initialOrder,
  onAddItem,
  addedItems,
}) => {
  // 선택적으로 CartContext 사용 (없으면 undefined)
  let cartApi = null;
  try {
    // CartProvider 미설치 상태에서도 앱이 죽지 않도록 try/catch
    cartApi = useCart();
  } catch (_) {}
  const { unit: unitList, default_unit } = useUnit();

 const [messageApi, contextHolder] = message.useMessage();
  const cart = cartApi?.cart || [];
  const addToCart = cartApi?.addItem;
  const [allItems, setAllItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedSubItem, setSelectedSubItem] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] =useState(default_unit);
  const [note, setNote] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);


const addedKeys = useMemo(() => {
    if (cart.length) {
      return new Set(
        cart
          .filter((i) => i.type === meatType)
          .map((i) => makeKey(i.type, i.value, i.label))
      );
    }
    return new Set(
      (addedItems || [])
        .filter((i) => i.type === meatType)
        .map((i) => makeKey(i.type, i.value, i.label))
    );
  }, [cart, addedItems, meatType]);

const orderCount = useMemo(() => {
  // CartContext가 우선
  if (cart.length) {
    return cart.length; // 🎉 전체 카트 품목 개수
  }
  // 폴백: addedItems (props)
  return (addedItems || []).length; // 🎉 전체 임시 목록 품목 개수
}, [cart, addedItems]); 

  // 이미 추가된 품목 value 목록 (CartContext 우선, 없으면 props.addedItems)
  const addedItemValues = useMemo(() => {
    if (cart.length) {
      // cart 아이템이 value를 안 가질 수도 있으니 label 기반으로 매칭하려면 서버 아이템 구조에 맞춰 조정하세요.
      return cart
        .map((i) => i.value)
        .filter(Boolean); // value가 있을 때만 체크
    }
    return (addedItems || []).map((i) => i.value);
  }, [cart, addedItems]);
useEffect(() => {
  console.log(default_unit)
  if (default_unit) {
    setUnit(default_unit);
  }
}, [default_unit]);
  // 품목 데이터 로드 + initialOrder 초기화
  useEffect(() => {
    let mounted = true;
    fetch(`${API_BASE_URL}/api/items`)
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        setAllItems(data || []);
        // initialOrder가 있으면 설정
        if (initialOrder) {
          const full = data.find(
            (i) =>
              i.value === initialOrder.value && i.type === initialOrder.type
          );
          if (full) {
            setSelectedItem(full);
            setQuantity(initialOrder.quantity || 1);
            setUnit(initialOrder.unit || default_unit);
            setNote(initialOrder.note || "");
            if (full.subItems?.length) {
              setSelectedSubItem(initialOrder.subItem || full.subItems[0]);
            } else {
              setSelectedSubItem(null);
            }
            setIsMenuOpen(false);
            return;
          }
        }
        // 신규 진입 초기화
        setSelectedItem(null);
        setSelectedSubItem(null);
        setQuantity(1);
        setUnit(default_unit);
        setNote("");
        setIsMenuOpen(true);
      })
      .catch((err) => console.error("Error fetching items:", err));
    return () => {
      mounted = false;
    };
  }, [meatType, initialOrder]);

  // meatType 필터
  const filteredItems = useMemo(
    () => allItems.filter((i) => i.type === meatType),
    [allItems, meatType]
  );

  // 품목 선택
  const handleItemSelect = (item) => {
    if (!item) {
      setSelectedItem(null);
      setSelectedSubItem(null);
      setQuantity(1);
      setUnit(default_unit);
      setNote("");
      setIsMenuOpen(true);
      return;
    }
    setSelectedItem(item);
    if (item.subItems?.length) {
      setSelectedSubItem(item.subItems[0]);
    } else {
      setSelectedSubItem(null);
    }
    setIsMenuOpen(false);
  };

  // 장바구니/임시목록에 추가
  const handleAddItemToOrder = () => {
    if (!selectedItem) {
      notification.warning({ message: "발주할 품목을 선택해주세요." });
      return;
    }
    if (selectedItem.subItems?.length && !selectedSubItem) {
      notification.warning({
        message: `${selectedItem.label}의 세부 부위를 선택해주세요.`,
      });
      return;
    }

    const newItem = {
      type: meatType, // 보존
      value: selectedItem.value,
      label: selectedItem.label,
      subItem: selectedSubItem || null,
      quantity: Number(quantity),
      unit,
      note: note?.trim() || "",
      // id는 CartContext에서 부여(디듀프) / 폴백(onAddItem) 경로에서는 임시 id 사용
      id: Date.now(),
    };
let itemAdded = false;

    // 1) CartContext가 있으면 그쪽으로
    if (addToCart) {
      addToCart(newItem);
      itemAdded = true;
    }
    // 2) 폴백: 부모 onAddItem prop 사용
    else if (typeof onAddItem === "function") {
      onAddItem(newItem);
      itemAdded = true;
    }

    if (itemAdded) {
      // UX: 입력값 리셋/메뉴 다시 열기 (이것은 QuickOrder 내부 상태를 위한 것)
      setSelectedItem(null);
      setSelectedSubItem(null);
      setQuantity(1);
      setUnit(default_unit);
      setNote("");
      setIsMenuOpen(true);

      messageApi.open({
        type: "success",
        content: `${selectedItem.label}${
          selectedSubItem ? ` (${selectedSubItem})` : ""
        } ${quantity}${unit} 추가 완료!`,
        duration: 1.2, // ⏱ 자동 사라짐
      });

      // 🎉 핵심 수정: 항목이 추가되었으면 무조건 닫고 대시보드 화면으로 돌아갑니다.
      if (typeof onClose === "function") {
        onClose(); 
      }
    }
  };

  // 단위 옵션
  const unitOptions = unitList.map((u) => (
    <AntSelect.Option key={u} value={u}>
      {u}
    </AntSelect.Option>
  ));

  return (
    <Container>
      {contextHolder}
      <Header>
        <Title level={3} style={{ margin: 0 }}>
          {meatType} 발주서 작성
        </Title>
        <Button onClick={onClose} size="large">
          닫기
        </Button>
      </Header>

      {/* 1단계: 품목 선택 */}
      <SelectContainer>
        <Text strong>1. 품목 선택 (검색)</Text>
        <Select
          options={filteredItems}
          components={{ Option: CustomOption }}
          placeholder={
            selectedItem
              ? `${meatType} 부위를 검색하거나 선택하세요...`
              : "🔴 품목을 선택해주세요"
          }
          isSearchable
          onChange={handleItemSelect}
          value={selectedItem}
          menuIsOpen={isMenuOpen}
          onMenuOpen={() => setIsMenuOpen(true)}
          onMenuClose={() => setIsMenuOpen(false)}
          /* CustomOption에서 확인할 수 있게 넘겨줌 */
          addedItemValues={addedItemValues}
          addedKeys={addedKeys}
          styles={{
            control: (base, state) => ({
              ...base,
              minHeight: 48,
              fontSize: 16,
              borderColor: selectedItem
                ? state.isFocused
                  ? "#3F8600"
                  : base.borderColor
                : "#ff4d4f",
              boxShadow: selectedItem
                ? base.boxShadow
                : "0 0 0 1px #ff4d4f",
            }),
            option: (base) => ({ ...base, padding: 0 }),
            menu: (base) => ({ ...base, position: "relative", overflowY: "auto" }),
          }}
        />
      </SelectContainer>

      {/* 2단계: 수량/단위/메모 (품목 선택된 경우에만) */}
      {selectedItem ? (
        <>
          <Text strong>2. {selectedItem.label} 발주 정보 입력</Text>

          {/* 하위 분류 */}
          {selectedItem.subItems?.length > 0 && (
            <div
              style={{
                marginBottom: 15,
                border: "1px solid #ddd",
                padding: 10,
                borderRadius: 6,
                background: "#fafafa",
              }}
            >
              <Text strong style={{ display: "block", marginBottom: 8 }}>
                세부 부위 선택:
              </Text>
              <AntSelect
                value={selectedSubItem}
                onChange={setSelectedSubItem}
                style={{ width: "100%" }}
                size="large"
              >
                {selectedItem.subItems.map((sub) => (
                  <AntSelect.Option key={sub} value={sub}>
                    {sub}
                  </AntSelect.Option>
                ))}
              </AntSelect>
            </div>
          )}

          {/* 수량/단위 */}
          <div style={{ padding: "10px 0", display: "flex" }}>
            <InputNumber
              min={1}
              value={quantity}
              onChange={setQuantity}
              addonBefore={<Text>수량</Text>}
              style={{ flexGrow: 1, marginRight: 10 }}
              size="large"
            />
            <AntSelect
              value={unit}
              onChange={setUnit}
              style={{ width: 120 }}
              size="large"
            >
              {unitOptions}
            </AntSelect>
          </div>

          {/* 특이사항 */}
          <Text strong>3. 특이사항</Text>
          <Input.TextArea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 6키로로 부탁, 크게, 지방 빼주세요"
            style={{ marginBottom: 15 }}
          />

          {/* 추가 버튼 */}
          <Button
            type="primary"
            size="large"
            onClick={handleAddItemToOrder}
            block
            style={{ marginBottom: 20 }}
          >
            장바구니 목록에 추가 (+)
          </Button>
        </>
      ) : (
        <div
          style={{
            textAlign: "center",
            marginTop: 50,
            padding: 20,
            border: "1px dashed #f0f0f0",
            borderRadius: 8,
          }}
        >
          <Title level={4} type="secondary" style={{ marginBottom: 8 }}>
            품목 선택 후 발주 정보를 입력해주세요.
          </Title>
          <Text type="secondary">
            상단의 검색창을 이용해 {meatType} 부위를 찾아주세요.
          </Text>
        </div>
      )}
    </Container>
  );
};

export default QuickOrder;
