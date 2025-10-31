import { API_BASE_URL } from "../constants/config";

export async function loginByPhone(phoneNumberRaw) {
  const phone = phoneNumberRaw.replace(/-/g, "");

  try {
    const res = await fetch(`${API_BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: phone }),
    });

    const data = await res.json();

    if (res.ok && data?.success) {
      const user = {
        customerId: data.user.customer_id,
        name: data.user.name,
        phoneNumber: data.user.phone_number,
        login_Kind: data.user.login_Kind,
      };
      console.log(user);
      return { success: true, user };
    }

    return { success: false, message: data?.message || "등록되지 않은 전화번호이거나 서버 오류입니다." };
  } catch (e) {
    console.error("loginByPhone error:", e);
    return { success: false, message: "네트워크 오류가 발생했습니다. 서버 URL을 확인해주세요." };
  }
}
