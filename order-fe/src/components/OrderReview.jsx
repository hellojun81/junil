// components/OrderReview.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, List, Button, Divider, Spin, notification, Tag, Modal, Space } from 'antd';
import { SyncOutlined, ReloadOutlined, HistoryOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import styled from 'styled-components';

const { Title, Text } = Typography;

// 💡 API 베이스 URL: App.jsx에서 사용되는 변수와 동일하게 재정의
const API_BASE_URL = window.location.hostname === '10.0.2.2' ? 
                     'http://10.0.2.2:3001' : 'http://' + window.location.hostname + ':3001';

// App.jsx에서 사용되던 스타일을 가져와 재정의
const OrderItem = styled(List.Item)`
  .ant-list-item-meta-title {
    font-weight: bold;
  }
`;

// Helper functions (Tag color/text)
const getStatusColor = (status) => {
    if (status === 'Approved') return 'green';
    if (status === 'Rejected') return 'red';
    return 'gold'; // Pending
};

const getStatusText = (status) => {
    if (status === 'Approved') return '승인 완료';
    if (status === 'Rejected') return '거부됨';
    return '승인 대기';
};

// =========================================================
// Component
// =========================================================

const OrderReview = ({ finalOrderList, onRemoveItem, onSubmitOrder, isLoadingSubmit }) => {
    const [pastOrders, setPastOrders] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    
    // 1. 지난 발주 내역 데이터 로드 (실제 API 호출)
    const fetchPastOrders = useCallback(async () => {
        setLoadingHistory(true);
        try {
            // 💡 서버 API 호출: /api/user/past-orders (사용자용 엔드포인트)
            const response = await fetch(`${API_BASE_URL}/api/user/past-orders`); 
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            // Data structure expected: [{ date: '...', status: '...', items: [{ label, quantity, unit, ... }] }]
            setPastOrders(data);
        } catch (error) {
            console.error('Error fetching past orders:', error);
            notification.error({ 
                message: '지난 발주 내역 로드 실패', 
                description: '서버 연결 또는 API 응답을 확인해주세요.' 
            });
            setPastOrders([]);
        } finally {
            setLoadingHistory(false);
        }
    }, []);

    useEffect(() => {
        fetchPastOrders();
    }, [fetchPastOrders]);

    // 2. 지난 발주 상세 모달
    const showPastOrderDetail = (order) => {
        Modal.info({
            title: `${order.date} 발주 상세 내역`,
            content: (
                <div>
                    <Text strong>상태:</Text> <Tag color={getStatusColor(order.status)}>{getStatusText(order.status)}</Tag>
                    <Divider style={{ margin: '8px 0'}} />
                    <Title level={5}>품목 목록 ({order.items ? order.items.length : 0}건)</Title>
                    <List
                        bordered
                        dataSource={order.items || []}
                        renderItem={item => (
                            <List.Item
                                actions={[
                                    // 💡 재발주 버튼: 이 아이템을 임시 목록에 추가하는 기능
                                    <Button 
                                        type="link" 
                                        // onReorderItem prop이 없으므로, onRemoveItem과 같은 방식으로 App.jsx에서 처리할 onReorder 함수를 받거나
                                        // 아니면 App.jsx의 handleAddItemToFinalList를 바로 호출하는 함수를 전달받아야 합니다.
                                        // 현재는 버튼만 표시합니다.
                                        onClick={() => notification.info({ message: `${item.label} 재발주 기능 구현이 필요합니다.` })}
                                    >
                                        재발주
                                    </Button>
                                ]}
                            >
                                <Text strong>{item.label}</Text>
                                {item.subItem && <Text type="secondary"> ({item.subItem})</Text>}
                                <div style={{ marginLeft: 'auto' }}>
                                    <Text>{item.quantity}{item.unit}</Text>
                                </div>
                            </List.Item>
                        )}
                    />
                </div>
            ),
            onOk() {},
        });
    };

    const totalQuantity = finalOrderList.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div style={{ padding: '0 0 16px', maxHeight: '100%', overflowY: 'auto' }}>
            {/* 1. 현재 임시 발주 목록 */}
            <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>🛒 현재 임시 발주 목록 ({finalOrderList.length}건)</Title>
            
            <List
                itemLayout="horizontal"
                dataSource={finalOrderList}
                locale={{ emptyText: '임시 목록이 비어있습니다.' }}
                renderItem={(item) => (
                    <OrderItem
                        actions={[
                            <Button
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => onRemoveItem(item.id)}
                            />
                        ]}
                    >
                        <List.Item.Meta
                            title={
                                <Space>
                                    <Text>{item.label}</Text>
                                    {item.subItem && <Text type="secondary">({item.subItem})</Text>}
                                </Space>
                            }
                            description={
                                <div>
                                    <Text strong>{item.quantity}{item.unit}</Text>
                                    {item.note && <Text type="secondary" style={{ marginLeft: 8 }}>/ {item.note}</Text>}
                                </div>
                            }
                        />
                    </OrderItem>
                )}
            />
            
            <Divider />
            
            {/* 💡 최종 발주서 전송 버튼 */}
            <div style={{ padding: '16px 0', background: '#fff' }}>
                <Button
                    type="primary"
                    size="large"
                    onClick={onSubmitOrder}
                    block
                    disabled={finalOrderList.length === 0}
                    loading={isLoadingSubmit}
                >
                    총 {finalOrderList.length}건 ({totalQuantity} {finalOrderList.length > 0 ? '개/키로/박스' : ''}) 발주서 전송
                </Button>
            </div>

            <Divider />

            {/* 2. 지난 발주 내역 (API 연동) */}
            <Title level={4} style={{ marginTop: 20, marginBottom: 16 }}>
                <HistoryOutlined style={{ marginRight: 8 }} />
                지난 발주 기록
            </Title>
            
            <Button icon={<SyncOutlined />} onClick={fetchPastOrders} loading={loadingHistory} style={{ marginBottom: 16 }}>
                내역 새로고침
            </Button>
            
            <Spin spinning={loadingHistory}>
                <List
                    dataSource={pastOrders}
                    locale={{ emptyText: '지난 발주 내역이 없습니다.' }}
                    renderItem={(order) => (
                        <List.Item
                            actions={[
                                <Button icon={<EyeOutlined />} onClick={() => showPastOrderDetail(order)}>상세</Button>,
                            ]}
                        >
                            <List.Item.Meta
                                title={
                                    <Space>
                                        <Text strong>{order.date} 발주</Text>
                                        <Tag color={getStatusColor(order.status)}>
                                            {getStatusText(order.status)}
                                        </Tag>
                                    </Space>
                                }
                                description={`품목: ${order.items ? order.items.map(item => item.label).join(', ') : '정보 없음'} | 총 ${order.items ? order.items.length : 0}건`}
                            />
                        </List.Item>
                    )}
                />
            </Spin>
        </div>
    );
};

export default OrderReview;