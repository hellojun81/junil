// src/components/SummaryCards.jsx
import React from "react";
import { Card, Row, Col, Statistic, Skeleton } from "antd";


const SummaryCards = ({ loading, data }) => (
<Row gutter={[16, 16]}>
<Col xs={12} md={6}><Card>{loading ? <Skeleton active/> : <Statistic title="오늘 주문건수" value={data.todayOrders}/>}</Card></Col>
<Col xs={12} md={6}><Card>{loading ? <Skeleton active/> : <Statistic title="오늘 품목수" value={data.todayItems}/>}</Card></Col>
<Col xs={12} md={6}><Card>{loading ? <Skeleton active/> : <Statistic title="이달 주문건수" value={data.monthOrders}/>}</Card></Col>
<Col xs={12} md={6}><Card>{loading ? <Skeleton active/> : <Statistic title="매출(추정)" value={data.revenue} prefix="₩"/>}</Card></Col>
</Row>
);


export default SummaryCards;