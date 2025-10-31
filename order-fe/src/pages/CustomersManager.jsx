import React, { useEffect, useMemo, useState } from "react";
import { Card, Space, Button, Modal, Form, Input, Table, Popconfirm, Select, App } from "antd";
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from "../api/admin";

export default function CustomersManager() {
  const { message } = App.useApp();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  // 검색 상태
  const [q, setQ] = useState("");               // 이름/전화/담당자/주소 검색
  const [page, setPage] = useState({ current: 1, pageSize: 20, total: 0 });

  // 폼/모달
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const params = useMemo(() => ({
    q: q?.trim() || "",
    page: page.current,
    pageSize: page.pageSize,
  }), [q, page.current, page.pageSize]);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await getCustomers(params);     // { list, total }
      setList(res.list || []);
      setPage((p) => ({ ...p, total: res.total ?? (res.list?.length || 0) }));
    } catch (e) {
      message.error("고객 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);                                // 최초
  useEffect(() => { setPage((p)=>({ ...p, current: 1 })); }, [q]);      // 검색어 변경 시 1페이지
  useEffect(() => { fetchList(); }, [params.page, params.pageSize]);    // 페이지 변경 시
 useEffect(() => { fetchList(); }, [params.q, params.page, params.pageSize]);
  const onSubmit = async () => {
    const v = await form.validateFields();
    try {
      if (editing) await updateCustomer(editing.phone_number, v); // 전화번호 기준 수정
      else         await createCustomer(v);
      message.success("저장되었습니다.");
      setOpen(false); setEditing(null); form.resetFields();
      fetchList();
    } catch (e) {
      message.error(e?.message || "저장 실패");
    }
  };

  const columns = [
    { title: "ID", dataIndex: "customer_id", width: 70 },
    { title: "전화번호", dataIndex: "phone_number", width: 140 },
    { title: "상호명", dataIndex: "name" },
    { title: "담당자", dataIndex: "contact_person", width: 120 },
    { title: "주소", dataIndex: "address", ellipsis: true },
    { title: "비고(내부)", dataIndex: "note_internal", ellipsis: true },
    { title: "배송메모", dataIndex: "note_delivery", ellipsis: true },
    {
      title: "작업", key: "act", width: 160,
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => {
            setEditing(r); setOpen(true); form.setFieldsValue(r);
          }}>수정</Button>
          <Popconfirm
            title="삭제하시겠습니까?"
            okText="삭제" cancelText="취소"
            onConfirm={async () => {
              try {
                await deleteCustomer(r.phone_number); // 전화번호 기준 삭제
                message.success("삭제되었습니다.");
                fetchList();
              } catch (e) {
                message.error(e?.message || "삭제 실패");
              }
            }}
          >
            <Button size="small" danger>삭제</Button>
          </Popconfirm>
        </Space>
      )
    },
  ];

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      <Card
        title="고객관리"
        extra={
          <Space>
            <Input.Search
              placeholder="이름/전화/담당자/주소 검색"
              allowClear
              style={{ width: 260 }}
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              onSearch={setQ}
            />
            <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>
              신규
            </Button>
          </Space>
        }
      >
        <Table
          rowKey={(r)=>r.customer_id}
          dataSource={list}
          loading={loading}
          columns={columns}
          pagination={{
            current: page.current,
            pageSize: page.pageSize,
            total: page.total,
            showSizeChanger: true,
            pageSizeOptions: [10,20,50,100],
            onChange: (current, pageSize) => setPage({ current, pageSize, total: page.total }),
          }}
        />
      </Card>

      <Modal
        title={editing ? "고객 수정" : "고객 등록"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText="저장"
 destroyOnClose
  afterOpenChange={(opened) => {
    if (opened && editing) {
      form.setFieldsValue(editing);
    } else if (opened && !editing) {
      form.resetFields();
    }
  }}
      >
      <Form form={form} layout="vertical" preserve={false}>
    <Form.Item name="phone_number" label="전화번호" rules={[{ required: true, message: "전화번호를 입력하세요" }]}>
      <Input /* disabled={!!editing} - 수정 시 변경 막고 싶으면 */ />
    </Form.Item>
    <Form.Item name="name" label="상호명" rules={[{ required: true, message: "상호명을 입력하세요" }]}>
      <Input />
    </Form.Item>
    <Form.Item name="contact_person" label="담당자"><Input /></Form.Item>
    <Form.Item name="address" label="주소"><Input /></Form.Item>
    <Form.Item name="note_internal" label="비고(내부)"><Input.TextArea rows={2} /></Form.Item>
    <Form.Item name="note_delivery" label="배송메모"><Input.TextArea rows={2} /></Form.Item>
  </Form>
      </Modal>
    </Space>
  );
}
