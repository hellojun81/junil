// src/pages/ItemsManager.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Card, Space, Button, Modal, Form, Input, Select, Table, message, Popconfirm, App
} from "antd";
import { getItemsAdmin, createItem, updateItem, deleteItem } from "../api/admin";

const typeOptions = [
  { value: "소", label: "소" },
  { value: "돼지", label: "돼지" },
];

export default function ItemsManager() {
  const { message } = App.useApp()
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  // 검색/필터
  const [q, setQ] = useState("");
  const [ftype, setFtype] = useState(); // "소" | "돼지" | undefined

  // 폼/모달
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchList = async () => {
    setLoading(true);
    try {
      const data = await getItemsAdmin({ q, type: ftype });
      setList(Array.isArray(data) ? data : (data.list || []));
    } catch (e) {
      console.error(e);
      message.error("상품 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);          // 최초
  useEffect(() => { fetchList(); }, [q, ftype]);  // 검색/필터 변경

  const onSubmit = async () => {
    const v = await form.validateFields();
    try {
      if (editing) await updateItem(editing.item_id, v);
      else         await createItem(v);
      message.success("저장되었습니다.");
      setOpen(false);
      setEditing(null);
      form.resetFields();
      fetchList();
    } catch (e) {
      message.error(e?.message || "저장 실패");
    }
  };

  const columns = useMemo(() => ([
    { title: "ID", dataIndex: "item_id", width: 80 },
    { title: "구분", dataIndex: "type", width: 100 },
    { title: "품목", dataIndex: "label" },
    { title: "단위", dataIndex: "unit", width: 90 },
    { title: "부위(콤마)", dataIndex: "sub_label", ellipsis: true },
    {
      title: "작업",
      key: "act",
      width: 200,
      render: (_, r) => (
        <Space>
          <Button size="small"
            onClick={() => {
              setEditing(r);
              setOpen(true);
              form.setFieldsValue({
                type: r.type, label: r.label, unit: r.unit, sub_label: r.sub_label || ""
              });
            }}>
            수정
          </Button>
          <Popconfirm
            title="삭제하시겠습니까?"
            okText="삭제" cancelText="취소"
            onConfirm={async () => {
              try {
                await deleteItem(r.item_id);
                message.success("삭제되었습니다.");
                fetchList();
              } catch (e) {
                message.error(e?.message || "삭제 실패(거래 사용 여부를 확인하세요)");
              }
            }}
          >
            <Button size="small" danger>삭제</Button>
          </Popconfirm>
        </Space>
      )
    },
  ]), [form]);

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      <Card
        title="상품관리"
        extra={
          <Space>
            <Select
              allowClear
              placeholder="구분"
              style={{ width: 120 }}
              value={ftype}
              onChange={setFtype}
              options={typeOptions}
            />
            <Input.Search
              placeholder="품목/부위 검색"
              allowClear
              onSearch={setQ}
              onChange={(e)=> setQ(e.target.value)}
              style={{ width: 220 }}
              value={q}
            />
            <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>
              신규
            </Button>
          </Space>
        }
      >
        <Table
          rowKey={(r) => r.item_id}
          dataSource={list}
          loading={loading}
          columns={columns}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title={editing ? "상품 수정" : "상품 등록"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText="저장"
        destroyOnClose
        afterOpenChange={(opened) => {
   if (!opened) return;
   if (editing) {
     form.setFieldsValue({
       type: editing.type,
       label: editing.label,
       unit: editing.unit,
       sub_label: editing.sub_label || "",
     });
   } else {
     form.resetFields();
   }
 }}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="type" label="구분" rules={[{ required: true, message: "구분을 선택하세요" }]}>
            <Select options={typeOptions} />
          </Form.Item>
          <Form.Item name="label" label="품목" rules={[{ required: true, message: "품목을 입력하세요" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="unit" label="단위" rules={[{ required: true, message: "단위를 선택하세요" }]}>
            <Select options={[{ value: "KG" }, { value: "BOX" }, { value: "EA" }]} />
          </Form.Item>
          <Form.Item
            name="sub_label"
            label="부위(콤마로 구분)"
            tooltip="예: 삼겹,항정,목살"
          >
            <Input placeholder="예: 삼겹,항정,목살" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
