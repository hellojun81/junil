import React from "react";
import { Input } from "antd";
import { PhoneOutlined } from "@ant-design/icons";
import { formatPhoneNumber } from "../utils/formatPhoneNumber";

const PhoneNumberInput = ({ value, onChange, onEnter }) => {
  const handleChange = (e) => {
    const raw = e.target.value;
    onChange(formatPhoneNumber(raw.replace(/-/g, "")));
  };

  return (
    <Input
      size="large"
      placeholder="전화번호 (010-xxxx-xxxx)"
      prefix={<PhoneOutlined />}
      value={value}
      onChange={handleChange}
      onPressEnter={onEnter}
      maxLength={13}
      style={{ marginBottom: 16 }}
      inputMode="numeric"
      autoComplete="tel"
    />
  );
};

export default PhoneNumberInput;
