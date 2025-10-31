// src/context/CartContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { notification } from "antd";
const mergeKey = (it) => `${it.label}::${it.subItem || it.sub_label || ""}::${it.unit || ""}`;

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

function keyOf(item) {
  return `${item.type}__${item.label}__${item.subItem || ""}__${item.unit || ""}__${item.note || ""}`;
}

const safeGet = (key, fallback = []) => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const safeSet = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};
const updateItem = (id, changes) => {
  setCart((prev) =>
    prev.map((item) =>
      item.id === id ? { ...item, ...changes } : item
    )
  );
};

const genId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);

/** ---------- Reducer ---------- */

/** ---------- Reducer ---------- */
function reducer(state, action) {
  switch (action.type) {
    case "HYDRATE":
      return Array.isArray(action.payload) ? action.payload : [];

    case "ADD": {
      const next = [...state];
      const k = keyOf(action.item);
      const idx = next.findIndex((i) => keyOf(i) === k);
      if (idx >= 0) {
        const prev = next[idx];
        next[idx] = {
          ...prev,
          quantity: Number(prev.quantity || 0) + Number(action.item.quantity || 0),
        };
      } else {
        next.push({
          ...action.item,
          id: action.item.id || genId(),
          unit: action.item.unit || "KG",
          quantity: Number(action.item.quantity) || 0,
          subItem: action.item.subItem ?? action.item.sub_label ?? null,
          createdAt: action.item.createdAt || new Date().toISOString(),
        });
      }
      return next;
    }

    /** 여러 개 품목을 한 번에 추가(동일키면 수량 병합) */
    case "ADD_MANY": {
      const map = new Map(state.map((it) => [keyOf(it), { ...it }]));
      const list = Array.isArray(action.items) ? action.items : [];

      for (const raw of list) {
        const item = {
          ...raw,
          id: raw.id || genId(),
          unit: raw.unit || "KG",
          quantity: Number(raw.quantity) || 0,
          subItem: raw.subItem ?? raw.sub_label ?? null,
          createdAt: raw.createdAt || new Date().toISOString(),
        };
        const k = keyOf(item);
        if (map.has(k)) {
          const cur = map.get(k);
          map.set(k, {
            ...cur,
            quantity: Number(cur.quantity || 0) + Number(item.quantity || 0),
          });
        } else {
          map.set(k, item);
        }
      }
      return Array.from(map.values());
    }

    case "UPDATE":
      return state.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i));

    case "REMOVE":
      return state.filter((i) => i.id !== action.id);

    case "CLEAR":
      return [];

    default:
      return state;
  }
}
// function reducer(state, action) {
//   switch (action.type) {
//     case "HYDRATE":
//       return Array.isArray(action.payload) ? action.payload : [];
//     case "ADD": {
//       const next = [...state];
//       const k = keyOf(action.item);
//       const idx = next.findIndex((i) => keyOf(i) === k);
//       if (idx >= 0) {
//         const prev = next[idx];
//         next[idx] = {
//           ...prev,
//           quantity: Number(prev.quantity || 0) + Number(action.item.quantity || 0),
//         };
//       } else {
//         const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
//         next.push({
//           ...action.item,
//           id,
//           createdAt: action.item.createdAt || new Date().toISOString(),
//         });
//       }
//       return next;
//     }
//     case "UPDATE":
//       return state.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i));
//     case "REMOVE":
//       return state.filter((i) => i.id !== action.id);
//     case "CLEAR":
//       return [];
//     default:
//       return state;
//   }
// }

export default function CartProvider({ user, children }) {
  const userId = user?.customerId ?? null;
  const storageKey = useMemo(() => `junil_cart:${userId ?? "guest"}`, [userId]);

  const [cart, dispatch] = useReducer(reducer, []);
  const [hydrated, setHydrated] = useState(false); // ✅ 하이드레이션 끝났는지 추적
  const prevStorageKeyRef = useRef(storageKey);
useEffect(() => {
    const prevKey = prevStorageKeyRef.current;
    if (prevKey !== storageKey) {
      // 새 키에 데이터가 없고, 이전 키에 데이터가 있으면 마이그레이션
      const nextData = safeGet(storageKey, []);
      if (!nextData.length) {
        const prevData = safeGet(prevKey, []);
        if (prevData.length) {
          safeSet(storageKey, prevData);
          // 필요시 이전 키 삭제
          // window.localStorage.removeItem(prevKey);
        }
      }
      prevStorageKeyRef.current = storageKey;
    }

    const initial = safeGet(storageKey, []);
    dispatch({ type: "HYDRATE", payload: initial });
    setHydrated(true);
  }, [storageKey]);
  // // 1) 초기 로드 (또는 user 변경 시 재로드)
  // useEffect(() => {
  //   // user가 막 생겼고, 이전 키가 guest였다면 마이그레이션 시도
  //   const prevKey = prevStorageKeyRef.current;
  //   if (prevKey !== storageKey) {
  //     // storageKey가 바뀌면, 새 키에서 불러오되 비어있고 이전 키(guest)에 데이터 있으면 이전 데이터 가져와 저장
  //     const nextData = safeGet(storageKey, []);
  //     if (!nextData.length) {
  //       const guestData = safeGet(prevKey, []);
  //       if (guestData.length) {
  //         safeSet(storageKey, guestData);     // 새 키로 복사
  //         // 원하는 경우: guest 데이터 제거
  //         // window.localStorage.removeItem(prevKey);
  //       }
  //     }
  //     prevStorageKeyRef.current = storageKey;
  //   }

  //   const initial = safeGet(storageKey, []);
  //   dispatch({ type: "HYDRATE", payload: initial });
  //   setHydrated(true);
  // }, [storageKey]);

  // 2) 저장 (하이드레이션 끝나기 전엔 절대 저장하지 않음)
  useEffect(() => {
    if (!hydrated) return;        // ✅ 여기서 빈 배열 덮어쓰는 문제 방지
    safeSet(storageKey, cart);
  }, [storageKey, cart, hydrated]);

  // 3) 여러 탭/창 동기화
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === storageKey) {
        const next = safeGet(storageKey, []);
        dispatch({ type: "HYDRATE", payload: next });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

  // ==== Public API ====
  const addItem = (item) => {
    if (!item?.type || !item?.label || !item?.quantity) {
      notification.warning({ message: "필수 입력 누락", description: "품목/수량은 필수입니다." });
      return;
    }
    dispatch({ type: "ADD", item });
    notification.success({ message: `[${item.label}] 장바구니에 추가` });
  };
const addItems = (items = [], { merge = true, notify = true } = {}) => {
    if (!Array.isArray(items) || !items.length) return;
    if (merge) {
      dispatch({ type: "ADD_MANY", items });
    } else {
      // 병합하지 않고 개별 ADD
      for (const it of items) dispatch({ type: "ADD", item: it });
    }
    if (notify) notification.success({ message: `장바구니에 ${items.length}건 추가` });
  };

  /** 주문 이력 → 장바구니 담기 전용 헬퍼(동일 품목 병합) */
  const addOrMergeItems = (items = []) => addItems(items, { merge: true, notify: true });

  const updateItem = (id, patch) => dispatch({ type: "UPDATE", id, patch });
  const removeItem = (id) => dispatch({ type: "REMOVE", id });
  const clear = () => dispatch({ type: "CLEAR" });

  return (
   <CartContext.Provider
      value={{
        cart,
        addItem,
        addItems,
        addOrMergeItems, // ✅ 최근 발주 → 장바구니 담기에서 사용
        updateItem,
        removeItem,
        clear,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
