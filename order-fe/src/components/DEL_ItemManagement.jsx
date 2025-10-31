// // ItemManagement.jsx

// import React, { useState, useEffect } from 'react';
// import { Table, Button, Modal, Form, Input, Typography, notification, Select } from 'antd';
// import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

// const { Title, Text } = Typography;
// const { Option } = Select;
// const API_BASE_URL = 'http://localhost:3001'; // 실제 백엔드 URL로 수정 필요

// const ItemManagement = () => {
//     const [items, setItems] = useState([]);
//     const [loading, setLoading] = useState(false);
//     const [isModalVisible, setIsModalVisible] = useState(false);
//     const [editingItem, setEditingItem] = useState(null);
//     const [form] = Form.useForm();

//     const fetchItems = async () => {
//         setLoading(true);
//         try {
//             // 관리용 API 호출
//             const response = await fetch(`${API_BASE_URL}/api/management/items`);
//             const data = await response.json();
//             setItems(data);
//         } catch (error) {
//             notification.error({ message: '품목 목록 로드 실패' });
//         } finally {
//             setLoading(false);
//         }
//     };

//     useEffect(() => {
//         fetchItems();
//     }, []);

//     const handleAdd = () => {
//         setEditingItem(null);
//         form.resetFields();
//         setIsModalVisible(true);
//     };

//     const handleEdit = (item) => {
//         setEditingItem(item);
//         form.setFieldsValue(item);
//         setIsModalVisible(true);
//     };

//     const handleDelete = async (item) => {
//         Modal.confirm({
//             title: '품목 삭제',
//             content: `[${item.type}] ${item.label} 품목을 정말로 삭제하시겠습니까?`,
//             okText: '삭제',
//             okType: 'danger',
//             cancelText: '취소',
//             onOk: async () => {
//                 try {
//                     const response = await fetch(`${API_BASE_URL}/api/management/items/${item.item_id}`, {
//                         method: 'DELETE',
//                     });
//                     if (response.ok) {
//                         notification.success({ message: '삭제 완료' });
//                         fetchItems();
//                     } else {
//                         notification.error({ message: '삭제 실패' });
//                     }
//                 } catch (error) {
//                     notification.error({ message: '네트워크 오류' });
//                 }
//             },
//         });
//     };

//     const handleSave = async (values) => {
//         const method = editingItem ? 'PUT' : 'POST';
//         const url = editingItem 
//             ? `${API_BASE_URL}/api/management/items/${editingItem.item_id}` // PUT (ID 기준)
//             : `${API_BASE_URL}/api/management/items`; // POST

//         try {
//             const response = await fetch(url, {
//                 method,
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(values),
//             });
            
//             if (response.ok) {
//                 notification.success({ message: editingItem ? '수정 완료' : '등록 완료' });
//                 setIsModalVisible(false);
//                 fetchItems();
//             } else {
//                 notification.error({ message: '처리 실패' });
//             }
//         } catch (error) {
//             notification.error({ message: '네트워크 오류' });
//         }
//     };

//     const columns = [
//         { title: 'ID', dataIndex: 'item_id', key: 'item_id', width: 60 },
//         { title: '축종', dataIndex: 'type', key: 'type', width: 80, 
//           filters: [{ text: '소', value: '소' }, { text: '돼지', value: '돼지' }],
//           onFilter: (value, record) => record.type.indexOf(value) === 0,
//         },
//         { title: '품목명 (Label)', dataIndex: 'label', key: 'label', width: 150 },
//         { title: '값 (Value)', dataIndex: 'value', key: 'value', width: 150 },
//         { title: '세부 분류 (콤마 구분)', dataIndex: 'sub_items', key: 'sub_items', ellipsis: true },
//         {
//             title: '관리', key: 'action', width: 100, fixed: 'right',
//             render: (_, record) => (
//                 <>
//                     <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} size="small" style={{ marginRight: 8 }} />
//                     <Button icon={<DeleteOutlined />} onClick={() => handleDelete(record)} size="small" danger />
//                 </>
//             ),
//         },
//     ];

//     return (
//         <div style={{ padding: 24 }}>
//             <Title level={2}>품목 관리</Title>
//             <div style={{ marginBottom: 16 }}>
//                 <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
//                     새 품목 등록
//                 </Button>
//             </div>
//             <Table
//                 columns={columns}
//                 dataSource={items}
//                 rowKey="item_id"
//                 loading={loading}
//                 scroll={{ x: 800 }}
//                 pagination={{ pageSize: 15 }}
//             />
            
//             {/* 등록/수정 모달 */}
//             <Modal
//                 title={editingItem ? '품목 수정' : '새 품목 등록'}
//                 open={isModalVisible}
//                 onCancel={() => setIsModalVisible(false)}
//                 footer={null}
//             >
//                 <Form form={form} layout="vertical" onFinish={handleSave}>
//                     <Form.Item name="type" label="축종" rules={[{ required: true, message: '축종을 선택해주세요.' }]}>
//                         <Select placeholder="선택">
//                             <Option value="소">🐮 소</Option>
//                             <Option value="돼지">🐷 돼지</Option>
//                         </Select>
//                     </Form.Item>
//                     <Form.Item name="label" label="품목명 (Label)" rules={[{ required: true, message: '품목명을 입력해주세요.' }]}>
//                         <Input />
//                     </Form.Item>
//                     <Form.Item name="value" label="값 (Value)" rules={[{ required: true, message: '값을 입력해주세요.' }]} extra={<Text type="secondary">모바일 앱에서 내부적으로 사용할 값입니다. (일반적으로 품목명과 동일)</Text>}>
//                         <Input />
//                     </Form.Item>
//                     <Form.Item name="sub_items" label="세부 분류 (콤마 구분)" extra={<Text type="secondary">세부 분류가 여러 개인 경우 콤마(,)로 구분하여 입력하세요. 예: 꾸리,부채살,앞다리살</Text>}>
//                         <Input.TextArea rows={2} />
//                     </Form.Item>
//                     <Form.Item>
//                         <Button type="primary" htmlType="submit" block>
//                             {editingItem ? '수정 완료' : '등록'}
//                         </Button>
//                     </Form.Item>
//                 </Form>
//             </Modal>
//         </div>
//     );
// };

// export default ItemManagement;