import React from "react";
import { Card, Form, Input, Select, Button, Space, message } from "antd";


const AdminSettings = () => {
const [form] = Form.useForm();


const onSave = async () => {
const v = await form.validateFields();
// TODO: 저장 API
message.success("저장되었습니다");
};


return (
<Space direction="vertical" style={{ width: "100%" }} size={16}>
<Card title="기본 설정">
<Form form={form} layout="vertical">
<Form.Item name="default_unit" label="기본 단위" initialValue="KG"> <Select options={[{value:"KG"},{value:"BOX"},{value:"EA"}]} /> </Form.Item>
<Form.Item name="dashboard_rows" label="대시보드 최근 표시건수" initialValue={10}> <Input type="number" min={5} max={100} /> </Form.Item>
<Form.Item name="company_name" label="회사명"> <Input /> </Form.Item>
<Button type="primary" onClick={onSave}>저장</Button>
</Form>
</Card>
</Space>
);
};


export default AdminSettings;