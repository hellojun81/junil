// components/OrderManagement.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { Table, Card, Typography, Tag, Button, Select, Input, Space, notification, Divider, Modal } from 'antd';
import { CheckOutlined, CloseOutlined, SearchOutlined, EyeOutlined, SyncOutlined } from '@ant-design/icons';
import styled from 'styled-components';

const { Title, Text } = Typography;
const { Option } = Select;

// 💡 API 베이스 URL: App.jsx에서 사용되는 변수와 동일하게 재정의
const API_BASE_URL = window.location.hostname === '10.0.2.2' ? 
                     'http://10.0.2.2:3001' : 'http://' + window.location.hostname + ':3001';

// =========================================================
// Styled Components (유지)
// =========================================================

const HeaderContainer = styled.div`
  margin-bottom: 24px;
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
`;

const FilterArea = styled(Space)`
  display: flex;
  margin-bottom: 16px;
  & > * {
    flex-grow: 1;
  }
`;

// =========================================================
// Component
// =========================================================

const OrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchText, setSearchText] = useState('');

  // 1. 주문 데이터 로드 (실제 API 호출)
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      // 💡 서버 API 호출: /api/admin/orders
      const response = await fetch(`${API_BASE_URL}/api/admin/orders`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      let filteredData = data;
      
      // 상태 필터링
      if (statusFilter !== 'All') {
        filteredData = filteredData.filter(order => order.status === statusFilter);
      }
      
      // 텍스트 검색 (사용자 이름 또는 품목 요약)
      if (searchText) {
        const lowerCaseSearch = searchText.toLowerCase();
        filteredData = filteredData.filter(order => 
          (order.user && order.user.toLowerCase().includes(lowerCaseSearch)) ||
          (order.items && order.items.some(item => item.label.toLowerCase().includes(lowerCaseSearch)))
        );
      }
      
      setOrders(filteredData);
      
    } catch (error) {
      console.error('Error fetching orders:', error);
      notification.error({ 
        message: '발주 내역 로드 실패', 
        description: '서버 연결 또는 API 응답 형식에 문제가 있습니다. 콘솔을 확인하세요.' 
      });
      setOrders([]); // 실패 시 목록 초기화
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchText]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);
  
  // 2. 상태 변경 핸들러 (실제 API 호출)
  const handleUpdateStatus = async (orderId, newStatus) => {
    setLoading(true);
    try {
      // 💡 서버 API 호출: /api/admin/order/{orderId}/status
      const response = await fetch(`${API_BASE_URL}/api/admin/order/${orderId}/status`, { 
        method: 'POST', 
        headers: { 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ status: newStatus }) 
      });
      
      if (!response.ok) {
        throw new Error(`Update failed with status: ${response.status}`);
      }
      
      // UI 즉시 업데이트
      const updatedOrders = orders.map(order => 
        order.orderId === orderId ? { ...order, status: newStatus } : order
      );
      setOrders(updatedOrders);
      
      notification.success({
        message: `${orderId} 발주가 ${newStatus === 'Approved' ? '승인' : '거부'} 처리되었습니다.`,
        duration: 2,
      });
      
    } catch (error) {
      console.error('Error updating status:', error);
      notification.error({ 
        message: '상태 변경 실패', 
        description: '서버 요청 중 오류가 발생했습니다. 콘솔을 확인하세요.' 
      });
    } finally {
      setLoading(false);
    }
  };
  
  // 3. 주문 상세 모달 (유지)
  const showOrderDetail = (order) => {
    Modal.info({
        title: `${order.orderId} 상세 내역 (By. ${order.user})`,
        content: (
            <div>
                <Text strong>발주 일시:</Text> <Text>{order.date}</Text><Divider style={{ margin: '8px 0'}} />
                <Text strong>현재 상태:</Text> <Tag color={getStatusColor(order.status)}>{getStatusText(order.status)}</Tag>
                <Divider style={{ margin: '8px 0'}} />
                <Title level={5}>품목 목록</Title>
                <List
                    bordered
                    dataSource={order.items}
                    renderItem={item => (
                        <List.Item>
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

  // 4. 테이블 관련 설정 (유지)
  
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

  const columns = [
    {
      title: 'ID',
      dataIndex: 'orderId',
      key: 'orderId',
      width: 100,
      sorter: (a, b) => a.orderId.localeCompare(b.orderId),
    },
    {
      title: '발주자',
      dataIndex: 'user',
      key: 'user',
      width: 100,
    },
    {
      title: '발주 일시',
      dataIndex: 'date',
      key: 'date',
      width: 150,
      sorter: (a, b) => new Date(b.date) - new Date(a.date),
    },
    {
      title: '품목 요약',
      dataIndex: 'items',
      key: 'items',
      render: (items) => {
        // items가 배열이 아닐 경우 처리
        if (!Array.isArray(items)) return <Text type="secondary">품목 없음</Text>;
        const summary = items.map(item => item.label).join(', ');
        return <Text ellipsis={{ tooltip: summary }}>{summary}</Text>;
      },
    },
    {
      title: '총 수량',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
      width: 80,
      sorter: (a, b) => a.totalQuantity - b.totalQuantity,
      render: (text) => <Text strong>{text || 0}</Text>
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Tag color={getStatusColor(status)} key={status}>
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '액션',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button icon={<EyeOutlined />} size="small" onClick={() => showOrderDetail(record)}>
            상세
          </Button>
          {record.status === 'Pending' && (
            <>
              <Button 
                type="primary" 
                icon={<CheckOutlined />} 
                size="small" 
                onClick={() => handleUpdateStatus(record.orderId, 'Approved')}
              >
                승인
              </Button>
              <Button 
                danger 
                icon={<CloseOutlined />} 
                size="small" 
                onClick={() => handleUpdateStatus(record.orderId, 'Rejected')}
              >
                거부
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <HeaderContainer>
        <Title level={3} style={{ marginTop: 0 }}>발주서 관리</Title>
        <Text type="secondary">전체 사용자의 발주 내역을 확인하고 처리합니다.</Text>
        <Divider />
        
        <FilterArea>
            <Input 
                placeholder="발주자 또는 품목 검색" 
                prefix={<SearchOutlined />} 
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ flex: 2 }}
            />
            <Select 
                defaultValue="All" 
                style={{ width: 150, flex: 1 }}
                onChange={setStatusFilter}
                value={statusFilter}
            >
                <Option value="All">전체 상태</Option>
                <Option value="Pending">승인 대기</Option>
                <Option value="Approved">승인 완료</Option>
                <Option value="Rejected">거부됨</Option>
            </Select>
            <Button type="default" icon={<SyncOutlined />} onClick={fetchOrders} loading={loading}>
                새로고침
            </Button>
        </FilterArea>
      </HeaderContainer>

      <Card bodyStyle={{ padding: 0 }}>
        <Table 
          columns={columns} 
          dataSource={orders} 
          rowKey="orderId" 
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  );
};

export default OrderManagement;