// src/components/StatsFilters.jsx
import React, { useState } from "react";
import { DatePicker, Space, Button, Select } from "antd";
import dayjs from "dayjs";


const { RangePicker } = DatePicker;


const StatsFilters = ({ onChange }) => {
const [dates, setDates] = useState([dayjs(), dayjs()]);
const [type, setType] = useState(null); // 돼지/소 필터
const [unit, setUnit] = useState(null); // KG/BOX/EA


const submit = () => {
onChange?.({
dateFrom: dates?.[0]?.format("YYYY-MM-DD") || null,
dateTo: dates?.[1]?.format("YYYY-MM-DD") || null,
type: type || null,
unit: unit || null,
});
};


return (
<Space wrap>
<RangePicker value={dates} onChange={setDates} allowClear={false} />
<Select
allowClear
placeholder="구분(소/돼지)"
options={[{value:"소",label:"소"},{value:"돼지",label:"돼지"}]}
style={{ width: 140 }}
value={type}
onChange={setType}
/>
<Select
allowClear
placeholder="UNIT"
options={[{value:"KG",label:"KG"},{value:"BOX",label:"BOX"},{value:"EA",label:"EA"}]}
style={{ width: 120 }}
value={unit}
onChange={setUnit}
/>
<Button type="primary" onClick={submit}>조회</Button>
</Space>
);
};


export default StatsFilters;