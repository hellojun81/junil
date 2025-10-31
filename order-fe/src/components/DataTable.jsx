// src/components/DataTable.jsx
import React from "react";
import { Table } from "antd";


const DataTable = ({ data, columns, loading }) => (
<Table
rowKey={(r, i) => r.id || r.key || `${i}-${r.label || r.sub_label || r.unit}`}
dataSource={data}
columns={columns}
loading={loading}
size="small"
pagination={{ pageSize: 15 }}
/>
);


export default DataTable;