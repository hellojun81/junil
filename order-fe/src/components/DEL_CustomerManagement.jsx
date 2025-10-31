// CustomerManagement.jsx

import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Typography, notification, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title } = Typography;
const { TextArea } = Input;
const API_BASE_URL = 'http://localhost:3001'; // 실제 백엔드 URL로 수정 필요

const CustomerManagement = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [searchText, setSearchText] = useState(''); // 💡 검색어 상태 추가
    const [form] = Form.useForm();

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/customers`);
            const data = await response.json();
            setCustomers(data);
        } catch (error) {
            notification.error({ message: '거래처 목록 로드 실패' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    const handleAdd = () => {
        setEditingCustomer(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = (customer) => {
        setEditingCustomer(customer);
        // DB 컬럼명에 맞게 데이터 수정 (customer_name -> name)
        const fields = {
            ...customer,
            // phone_number는 유일 키이므로, 수정 모드에서는 변경 불가능하게 처리하는 것이 일반적입니다.
        };
        form.setFieldsValue(fields);
        setIsModalVisible(true);
    };

    const handleDelete = async (customer) => {
        Modal.confirm({
            title: '거래처 삭제',
            content: `${customer.name} (${customer.phone_number}) 거래처를 정말로 삭제하시겠습니까?`,
            okText: '삭제',
            okType: 'danger',
            cancelText: '취소',
            onOk: async () => {
                try {
                    // DB는 phone_number를 기준으로 삭제합니다.
                    const response = await fetch(`${API_BASE_URL}/api/customers/${customer.phone_number}`, {
                        method: 'DELETE',
                    });
                    if (response.ok) {
                        notification.success({ message: '삭제 완료' });
                        fetchCustomers();
                    } else {
                        notification.error({ message: '삭제 실패' });
                    }
                } catch (error) {
                    notification.error({ message: '네트워크 오류' });
                }
            },
        });
    };

    const handleSave = async (values) => {
        const method = editingCustomer ? 'PUT' : 'POST';
        const url = editingCustomer 
            ? `${API_BASE_URL}/api/customers/${editingCustomer.phone_number}` 
            : `${API_BASE_URL}/api/customers`; 

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            
            if (response.ok) {
                notification.success({ message: editingCustomer ? '수정 완료' : '등록 완료' });
                setIsModalVisible(false);
                fetchCustomers();
            } else {
                const errorData = await response.json();
                notification.error({ message: errorData.message || '처리 실패: 서버 응답을 확인하세요.' });
            }
        } catch (error) {
            notification.error({ message: '네트워크 오류' });
        }
    };
    
    // 💡 검색 필터링 로직
    const filteredCustomers = customers.filter(customer => {
        const search = searchText.toLowerCase();
        return (
            customer.name.toLowerCase().includes(search) ||
            customer.phone_number.toLowerCase().includes(search) ||
            (customer.contact_person && customer.contact_person.toLowerCase().includes(search))
        );
    });

    // 💡 컬럼 정의 (데이터 바인딩에 맞춰 수정됨)
    // DB 컬럼 구조: name, phone_number, contact_person, address, note_internal, note_delivery
    const columns = [
        { title: '상호명', dataIndex: 'name', key: 'name', width: 150, fixed: 'left' },
        { title: '전화번호', dataIndex: 'phone_number', key: 'phone_number', width: 150 },
        { title: '담당자', dataIndex: 'contact_person', key: 'contact_person', width: 100 },
        { title: '주소', dataIndex: 'address', key: 'address', ellipsis: true },
        { title: '내부 메모', dataIndex: 'note_internal', key: 'note_internal', ellipsis: true },
        { title: '배송 특이사항', dataIndex: 'note_delivery', key: 'note_delivery', ellipsis: true },
        {
            title: '관리', key: 'action', width: 100, fixed: 'right',
            render: (_, record) => (
                <>
                    <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} size="small" style={{ marginRight: 8 }} />
                    <Button icon={<DeleteOutlined />} onClick={() => handleDelete(record)} size="small" danger />
                </>
            ),
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <Title level={2}>거래처 관리</Title>
            
            {/* 💡 검색란과 버튼 영역 */}
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Input.Search
                    placeholder="상호명, 전화번호, 담당자로 검색"
                    allowClear
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 300 }}
                />
                
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                    새 거래처 등록
                </Button>
            </div>
            
            {/* 💡 필터링된 데이터 사용 */}
            <Table
                columns={columns}
                dataSource={filteredCustomers}
                rowKey="customer_id" // 💡 PK인 customer_id 사용
                loading={loading}
                scroll={{ x: 1200 }}
                pagination={{ pageSize: 10 }}
            />
            
            {/* 등록/수정 모달 */}
            <Modal
                title={editingCustomer ? '거래처 수정' : '새 거래처 등록'}
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                footer={null}
            >
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Form.Item name="name" label="상호명" rules={[{ required: true, message: '상호명을 입력해주세요.' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item 
                        name="phone_number" 
                        label="전화번호" 
                        rules={[{ required: true, message: '전화번호를 입력해주세요.' }]}
                    >
                        {/* 수정 모드에서는 전화번호를 변경할 수 없도록 비활성화 */}
                        <Input placeholder="예: 010-1234-5678" disabled={!!editingCustomer} />
                    </Form.Item>
                    <Form.Item name="contact_person" label="담당자 이름">
                        <Input />
                    </Form.Item>
                    <Form.Item name="address" label="주소">
                        <Input />
                    </Form.Item>
                    <Form.Item name="note_internal" label="내부 관리용 메모">
                        <TextArea rows={2} />
                    </Form.Item>
                    <Form.Item name="note_delivery" label="발주/배송 특이사항">
                        <TextArea rows={2} />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block>
                            {editingCustomer ? '수정 완료' : '등록'}
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default CustomerManagement;