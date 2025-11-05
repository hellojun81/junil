import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { notification } from "antd";
import { useUnit } from "../api/DefaultSetting"; // 🔹 추가

const mergeKey = (it) =>
  `${it.label}::${it.subItem || it.sub_label || ""}::${it.unit || ""}`;

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

function keyOf(item) {
  const type = item.type || "";
  const main = item.value || item.label || "";
  const sub = String(item.subItem || item.sub_label || "").trim();
  const unit = String(item.unit || "").trim();

  return `${type}__${main}__${sub}__${unit}`;
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
  } catch { }
};

const genId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);

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
          quantity:
            Number(prev.quantity || 0) + Number(action.item.quantity || 0),
        };
      } else {
        next.push({
          ...action.item,
          id: action.item.id || genId(),
          // 🔸 unit은 이미 addItem에서 default_unit으로 세팅됨
          unit: action.item.unit,
          quantity: Number(action.item.quantity) || 0,
          subItem: action.item.subItem ?? action.item.sub_label ?? null,
          createdAt: action.item.createdAt || new Date().toISOString(),
        });
      }
      return next;
    }

    case "ADD_MANY": {
      const map = new Map(state.map((it) => [keyOf(it), { ...it }]));
      const list = Array.isArray(action.items) ? action.items : [];

      for (const raw of list) {
        const item = {
          ...raw,
          id: raw.id || genId(),
          // 🔸 여기서도 unit은 이미 normalize 되어 있다고 가정
          unit: raw.unit,
          quantity: Number(raw.quantity) || 0,
          subItem: raw.subItem ?? raw.sub_label ?? null,
          createdAt: raw.createdAt || new Date().toISOString(),
        };
        const k = keyOf(item);
        if (map.has(k)) {
          const cur = map.get(k);
          map.set(k, {
            ...cur,
            quantity:
              Number(cur.quantity || 0) + Number(item.quantity || 0),
          });
        } else {
          map.set(k, item);
        }
      }
      return Array.from(map.values());
    }

    case "UPDATE":
      return state.map((i) =>
        i.id === action.id ? { ...i, ...action.patch } : i
      );

    case "REMOVE":
      return state.filter((i) => i.id !== action.id);

    case "CLEAR":
      return [];

    default:
      return state;
  }
}

export default function CartProvider({ user, children }) {
  const userId = user?.customerId ?? null;
  const storageKey = useMemo(
    () => `junil_cart:${userId ?? "guest"}`,
    [userId]
  );

  const [cart, dispatch] = useReducer(reducer, []);
  const [hydrated, setHydrated] = useState(false);
  const prevStorageKeyRef = useRef(storageKey);

  // 🔹 서버에서 단위 목록 + 기본 단위 가져오기
  const { unit: unitList, default_unit } = useUnit();
  // console.log("CartContext default_unit:", default_unit);

  useEffect(() => {
    const prevKey = prevStorageKeyRef.current;
    if (prevKey !== storageKey) {
      const nextData = safeGet(storageKey, []);
      if (!nextData.length) {
        const prevData = safeGet(prevKey, []);
        if (prevData.length) {
          safeSet(storageKey, prevData);
        }
      }
      prevStorageKeyRef.current = storageKey;
    }

    const initial = safeGet(storageKey, []);
    dispatch({ type: "HYDRATE", payload: initial });
    setHydrated(true);
  }, [storageKey]);

  // 저장
  useEffect(() => {
    if (!hydrated) return;
    safeSet(storageKey, cart);
  }, [storageKey, cart, hydrated]);

  // 여러 탭 동기화
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

  // 🔸 unit 없을 때 서버의 default_unit을 적용하는 헬퍼
  const withDefaultUnit = (item) => {
    const fallbackUnit = default_unit || "KG"; // 서버 설정 없을 때 최후 fallback
    return {
      ...item,
      unit: item.unit || fallbackUnit,
    };
  };

  const addItem = (item, { notify = true } = {}) => {
    if (!item?.type || !item?.label || !item?.quantity) {
      notification.warning({
        message: "필수 입력 누락",
        description: "품목/수량은 필수입니다.",
      });
      return;
    }

    const normalized = withDefaultUnit(item);
    dispatch({ type: "ADD", item: normalized });

    if (notify) {
      notification.success({ message: `[${normalized.label}] 장바구니에 추가` });
    }
  };

  const addItems = (items = [], { merge = true, notify = true } = {}) => {
    if (!Array.isArray(items) || !items.length) return;

    const normalizedItems = items.map(withDefaultUnit);

    if (merge) {
      dispatch({ type: "ADD_MANY", items: normalizedItems });
    } else {
      for (const it of normalizedItems) {
        dispatch({ type: "ADD", item: it });
      }
    }

    if (notify) {
      notification.success({
        message: `장바구니에 ${normalizedItems.length}건 추가`,
      });
    }
  };

  const addOrMergeItems = (items = []) =>
    addItems(items, { merge: true, notify: true });

  const updateItem = (id, patch) =>
    dispatch({ type: "UPDATE", id, patch });
  const removeItem = (id) => dispatch({ type: "REMOVE", id });
  const clear = () => dispatch({ type: "CLEAR" });

  return (
    <CartContext.Provider
      value={{
        cart,
        addItem,
        addItems,
        addOrMergeItems,
        updateItem,
        removeItem,
        clear,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
