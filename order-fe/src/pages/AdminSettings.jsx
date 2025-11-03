import React, { useEffect, useState } from "react";
import { Card, Form, Input, Select, Button, Space, message, Spin } from "antd";
import { getSettings, updateSettings } from "../api/admin";

const AdminSettings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unitOptions, setUnitOptions] = useState([]); // ["KG","BOX","EA"]

  const load = async () => {
    setLoading(true);
    try {
      const s = await getSettings();
      setUnitOptions(s.units?.length ? s.units : ["KG","BOX","EA"]);

      form.setFieldsValue({
        company_name: s.company_name || "",
        default_unit: s.default_unit || (s.units?.[0] || "KG"),
        dashboard_rows: s.dashboard_rows ?? 10,
        units_csv: (s.units && s.units.length) ? s.units.join(",") : "KG,BOX,EA",
      });
    } catch (e) {
      console.error(e);
      message.error("설정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onSave = async () => {
    try {
      const v = await form.validateFields();

      // 콤마 구분 단위 → 배열
      const units = String(v.units_csv || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

      if (!units.length) {
        return message.error("단위 목록을 1개 이상 입력하세요.");
      }
      if (!units.includes(v.default_unit)) {
        units.unshift(v.default_unit); // 기본 단위 강제 포함
      }

      setSaving(true);
      await updateSettings({
        company_name: v.company_name?.trim() ?? "",
        default_unit: v.default_unit,
        dashboard_rows: Number(v.dashboard_rows) || 10,
        units, // 서버에서 units_json으로 저장
      });
      message.success("저장되었습니다");
      setUnitOptions(units);
    } catch (e) {
      if (e?.errorFields) return; // 폼 검증 에러
      console.error(e);
      message.error("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      <Card title="기본 설정">
        <Spin spinning={loading}>
          <Form form={form} layout="vertical">
            <Form.Item
              name="company_name"
              label="회사명"
              rules={[{ required: true, message: "회사명을 입력하세요" }]}
            >
              <Input placeholder="예) 아우브 스튜디오" />
            </Form.Item>

            <Form.Item
              name="default_unit"
              label="기본 단위"
              rules={[{ required: true, message: "기본 단위를 선택하세요" }]}
            >
              <Select
                placeholder="단위를 선택하세요"
                options={(unitOptions || []).map(u => ({ value: u, label: u }))}
              />
            </Form.Item>

            <Form.Item
              name="units_csv"
              label="단위 목록 (콤마 구분: 예) KG,BOX,EA)"
              tooltip="여기 목록은 Select 옵션으로 사용됩니다."
              rules={[{ required: true, message: "단위 목록을 입력하세요" }]}
            >
              <Input placeholder="KG,BOX,EA" />
            </Form.Item>

            <Form.Item
              name="dashboard_rows"
              label="대시보드 최근 표시건수"
              rules={[
                { required: true, message: "표시 건수를 입력하세요" },
                () => ({
                  validator(_, value) {
                    const n = Number(value);
                    if (!Number.isFinite(n) || n < 5 || n > 100) {
                      return Promise.reject(new Error("5 ~ 100 사이의 숫자"));
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <Input type="number" min={5} max={100} />
            </Form.Item>

            <Button type="primary" onClick={onSave} loading={saving}>
              저장
            </Button>
          </Form>
        </Spin>
      </Card>
    </Space>
  );
};

export default AdminSettings;
