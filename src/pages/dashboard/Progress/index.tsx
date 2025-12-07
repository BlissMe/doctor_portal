import React, { useEffect, useState, useMemo } from "react";
import {
  Row,
  Col,
  Card,
  Table,
  Tag,
  Timeline,
  Drawer,
  Descriptions,
  Select,
  DatePicker,
  Input,
  Button,
  Space,
  Statistic,
  Badge,
  Empty,
  Spin,
} from "antd";
import { SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const { RangePicker } = DatePicker;
const { Option } = Select;

// --- Configuration ---
const API_BASE = import.meta.env.REACT_APP_API_BASE;
const COLORS = ["#2f54eb", "#fa8c16", "#ff4d4f"]; // low, medium, high

export default function MonitorAgentDashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [agentFilter, setAgentFilter] = useState(undefined);
  const [riskFilter, setRiskFilter] = useState(undefined);
  const [searchText, setSearchText] = useState("");
  const [dateRange, setDateRange] = useState(null);

  // Fetch events (default: all users). You can change this to fetch per-user sessions.
  async function fetchEvents() {
    try {
      setLoading(true);
      // Example: fetch all events for demo. Adapt to your backend query params.
      const res = await fetch(`${API_BASE}/monitor-agent/get-session-events?user_id=1`);
      const data = await res.json();
      // Expected structure { user_id, events: [...] }
      const normalized = (data.events || []).map((e) => ({
        ...e,
        timestamp: e.timestamp ? new Date(e.timestamp) : null,
        risk_level: (e.risk_level || (e.monitor_summary && e.risk_level)) || e.risk_level || "low",
      }));
      setEvents(normalized.reverse()); // show newest first
    } catch (err) {
      console.error("fetchEvents", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agents = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.agent_name))).filter(Boolean);
  }, [events]);

  const stats = useMemo(() => {
    const total = events.length;
    const anomalies = events.filter((e) => e.anomaly_detected).length;
    const byRisk = { low: 0, medium: 0, high: 0 };
    events.forEach((e) => {
      const r = (e.risk_level || "low").toLowerCase();
      byRisk[r] = (byRisk[r] || 0) + 1;
    });

    return { total, anomalies, byRisk };
  }, [events]);

  const pieData = [
    { name: "Low", value: stats.byRisk.low },
    { name: "Medium", value: stats.byRisk.medium },
    { name: "High", value: stats.byRisk.high },
  ];

  function riskTag(risk) {
    const r = (risk || "low").toLowerCase();
    const color = r === "high" ? "red" : r === "medium" ? "orange" : "green";
    return <Tag color={color}>{r.toUpperCase()}</Tag>;
  }

  function openDrawer(record) {
    setSelectedEvent(record);
    setDrawerVisible(true);
  }

  const filteredEvents = events.filter((e) => {
    if (agentFilter && e.agent_name !== agentFilter) return false;
    if (riskFilter && (e.risk_level || "").toLowerCase() !== riskFilter) return false;
    if (searchText) {
      const hay = `${e.agent_name} ${JSON.stringify(e.input_data)} ${JSON.stringify(e.output_data)} ${e.monitor_summary || ""}`.toLowerCase();
      if (!hay.includes(searchText.toLowerCase())) return false;
    }
    if (dateRange && dateRange.length === 2 && e.timestamp) {
      const [start, end] = dateRange;
      if (!(e.timestamp >= start.startOf && e.timestamp >= start && e.timestamp <= end)) {
        // fallback: compare Date objects
        const s = dateRange[0].toDate ? dateRange[0].toDate() : dateRange[0];
        const en = dateRange[1].toDate ? dateRange[1].toDate() : dateRange[1];
        if (e.timestamp < s || e.timestamp > en) return false;
      }
    }
    return true;
  });

  const columns = [
    {
      title: "Timestamp",
      dataIndex: "timestamp",
      key: "timestamp",
      render: (t) => (t ? new Date(t).toLocaleString() : "-"),
      sorter: (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
      defaultSortOrder: "descend",
    },
    {
      title: "Agent",
      dataIndex: "agent_name",
      key: "agent_name",
      filters: agents.map((a) => ({ text: a, value: a })),
      onFilter: (value, record) => record.agent_name === value,
    },
    {
      title: "Summary",
      dataIndex: "monitor_summary",
      key: "monitor_summary",
      render: (t) => <div style={{ maxWidth: 350, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t || <i>—</i>}</div>,
    },
    {
      title: "Risk",
      dataIndex: "risk_level",
      key: "risk_level",
      render: (r) => riskTag(r),
      filters: [
        { text: "Low", value: "low" },
        { text: "Medium", value: "medium" },
        { text: "High", value: "high" },
      ],
      onFilter: (value, record) => (record.risk_level || "").toLowerCase() === value,
    },
    {
      title: "Anomaly",
      dataIndex: "anomaly_detected",
      key: "anomaly_detected",
      render: (a) => (a ? <Badge status="error" text="Yes" /> : <Badge status="success" text="No" />),
      filters: [
        { text: "Yes", value: "yes" },
        { text: "No", value: "no" },
      ],
      onFilter: (value, record) => (value === "yes" ? record.anomaly_detected : !record.anomaly_detected),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={24} md={16} lg={16} xl={16}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic title="Total Events" value={stats.total} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic title="Anomalies" value={stats.anomalies} />
              </Card>
            </Col>
            <Col xs={24} sm={24} md={8}>
              <Card>
                <Statistic title="Risk: High" value={stats.byRisk.high} />
              </Card>
            </Col>
          </Row>
        </Col>

        <Col xs={24} sm={24} md={8} lg={8} xl={8}>
          <Card title="Risk Distribution" style={{ height: "100%" }}>
            {stats.total === 0 ? (
              <Empty description="No data" />
            ) : (
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={60} label>
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
          <Space>
            <Input
              placeholder="Search input/output/summary"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 320 }}
            />

            <Select
              placeholder="Filter by agent"
              allowClear
              style={{ width: 160 }}
              value={agentFilter}
              onChange={(v) => setAgentFilter(v)}
            >
              {agents.map((a) => (
                <Option key={a} value={a}>
                  {a}
                </Option>
              ))}
            </Select>

            <Select
              placeholder="Filter by risk"
              allowClear
              style={{ width: 140 }}
              value={riskFilter}
              onChange={(v) => setRiskFilter(v)}
            >
              <Option value="low">Low</Option>
              <Option value="medium">Medium</Option>
              <Option value="high">High</Option>
            </Select>

            <RangePicker onChange={(r) => setDateRange(r)} />

            <Button icon={<ReloadOutlined />} onClick={fetchEvents} />
          </Space>

          <Space>
            <Button onClick={() => { setSearchText(""); setAgentFilter(undefined); setRiskFilter(undefined); setDateRange(null); }}>Reset</Button>
            <Button type="primary" onClick={fetchEvents}>Refresh</Button>
          </Space>
        </Space>
      </Card>

      <Card>
        <Spin spinning={loading} tip="Loading events...">
          <Table
            columns={columns}
            dataSource={filteredEvents}
            rowKey={(r) => r._id || `${r.timestamp}-${r.agent_name}`}
            onRow={(record) => ({
              onClick: () => openDrawer(record),
            })}
            pagination={{ pageSize: 12 }}
            locale={{ emptyText: <Empty description="No events" /> }}
          />
        </Spin>
      </Card>

      <Drawer
        title={selectedEvent ? `${selectedEvent.agent_name} — ${selectedEvent.risk_level?.toUpperCase() || ""}` : "Event details"}
        visible={drawerVisible}
        width={720}
        onClose={() => setDrawerVisible(false)}
      >
        {selectedEvent ? (
          <>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Timestamp">{selectedEvent.timestamp ? new Date(selectedEvent.timestamp).toLocaleString() : "-"}</Descriptions.Item>
              <Descriptions.Item label="Agent">{selectedEvent.agent_name}</Descriptions.Item>
              <Descriptions.Item label="Session/User">{`${selectedEvent.session_id || "-"} / ${selectedEvent.user_id || "-"}`}</Descriptions.Item>
              <Descriptions.Item label="Risk">{riskTag(selectedEvent.risk_level)}</Descriptions.Item>
              <Descriptions.Item label="Anomaly Detected">{selectedEvent.anomaly_detected ? "Yes" : "No"}</Descriptions.Item>
              <Descriptions.Item label="AI Summary">{selectedEvent.monitor_summary || "—"}</Descriptions.Item>
            </Descriptions>

            <Card title="Input Data" size="small" style={{ marginTop: 12 }}>
              <pre style={{ maxHeight: 220, overflow: "auto" }}>{JSON.stringify(selectedEvent.input_data, null, 2)}</pre>
            </Card>

            <Card title="Output Data" size="small" style={{ marginTop: 12 }}>
              <pre style={{ maxHeight: 220, overflow: "auto" }}>{JSON.stringify(selectedEvent.output_data, null, 2)}</pre>
            </Card>

            <Card title="AI Agent Details" size="small" style={{ marginTop: 12 }}>
              <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(selectedEvent.monitoring || selectedEvent.monitor_result || {}, null, 2)}</pre>
            </Card>
          </>
        ) : (
          <Empty />
        )}
      </Drawer>

      <Card title="Activity Timeline" style={{ marginTop: 16 }}>
        {events.length === 0 ? (
          <Empty description="No timeline" />
        ) : (
          <Timeline>
            {events.slice(0, 50).map((e) => (
              <Timeline.Item
                key={e._id || `${e.timestamp}-${e.agent_name}`}
                color={(e.risk_level || "low").toLowerCase() === "high" ? "red" : (e.risk_level || "low").toLowerCase() === "medium" ? "orange" : "green"}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <b>{e.agent_name}</b>
                    <div style={{ fontSize: 12 }}>{e.monitor_summary || (e.output_data && JSON.stringify(e.output_data).slice(0, 120))}</div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 160 }}>
                    <div style={{ fontSize: 12 }}>{e.timestamp ? new Date(e.timestamp).toLocaleString() : "-"}</div>
                    <div>{riskTag(e.risk_level)}</div>
                  </div>
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Card>
    </div>
  );
}
