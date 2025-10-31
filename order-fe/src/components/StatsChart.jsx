import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";


const StatsChart = ({ data, xKey, yKey }) => (
<div style={{ width: "100%", height: 280 }}>
<ResponsiveContainer>
<LineChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
<CartesianGrid strokeDasharray="3 3" />
<XAxis dataKey={xKey} />
<YAxis allowDecimals={false} />
<Tooltip />
<Line type="monotone" dataKey={yKey} stroke="#1677ff" strokeWidth={2} dot={false} />
</LineChart>
</ResponsiveContainer>
</div>
);


export default StatsChart;