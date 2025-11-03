// src/pages/OrdersStats.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Card, Space, Typography, Tabs } from "antd";
import StatsFilters from "../components/StatsFilters";
import DataTable from "../components/DataTable";
import { getOrdersByGroup } from "../api/admin";


const { Title } = Typography;


const OrdersStats = () => {
const [range, setRange] = useState({ dateFrom: null, dateTo: null }); // 기본: 오늘
const [loading, setLoading] = useState(false);
const [byItem, setByItem] = useState([]);
const [byPart, setByPart] = useState([]); // 부위(sub_label)
const [byUnit, setByUnit] = useState([]);


const columnsCommon = [
{ title: "수량", dataIndex: "quantity", key: "quantity", width: 100 },
{ title: "주문건수", dataIndex: "orders", key: "orders", width: 120 },
];


const itemCols = [
{ title: "품목", dataIndex: "label", key: "label" },
...columnsCommon,
];
const partCols = [
{ title: "부위", dataIndex: "sub_label", key: "sub_label" },
...columnsCommon,
];
const unitCols = [
{ title: "단위", dataIndex: "unit", key: "unit", width: 100 },
...columnsCommon,
];


const fetchAll = async (params) => {
setLoading(true);
try {
const [ri, rp, ru] = await Promise.all([
getOrdersByGroup({ groupBy: "label", ...params }),
getOrdersByGroup({ groupBy: "sub_label", ...params }),
getOrdersByGroup({ groupBy: "unit", ...params }),
]);
setByItem(ri);
setByPart(rp);
setByUnit(ru);
} finally {
setLoading(false);
}
};


useEffect(() => { fetchAll(range); }, []);


return (
<Space direction="vertical" style={{ width: "100%" }} size={16}>
<Title level={3}>주문 통계</Title>
<Card>
<StatsFilters onChange={(p) => { setRange(p); fetchAll(p); }} />
</Card>


<Tabs
defaultActiveKey="item"
items={[
{ key: "item", label: "품목별", children: <DataTable loading={loading} data={byItem} columns={itemCols} /> },
{ key: "part", label: "부위별", children: <DataTable loading={loading} data={byPart} columns={partCols} /> },
{ key: "unit", label: "UNIT별", children: <DataTable loading={loading} data={byUnit} columns={unitCols} /> },
]}
/>
</Space>
);
};


export default OrdersStats;