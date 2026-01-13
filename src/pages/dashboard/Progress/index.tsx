import { useEffect, useState, useMemo } from "react";
import {
  Row,
  Col,
  Card,
  Table,
  Tag,
  Drawer,
  Descriptions,
  Select,
  Button,
  Space,
  Statistic,
  Badge,
  Empty,
  Spin,
  Typography,
  Timeline
} from "antd";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import {
  ExclamationCircleOutlined,
  WarningOutlined,
  RadarChartOutlined,
} from "@ant-design/icons";

const { Option } = Select;

const API_BASE = import.meta.env.VITE_APP_PYTHON_URL;
const COLORS = ["#2f54eb", "#fa8c16", "#ff4d4f"];

// ------------------------------
// TYPES
// ------------------------------
interface EventRecord {
  _id?: string;
  timestamp?: string | Date | null;
  agent_name?: string;
  risk_level?: string;
  session_id?: string;
  user_id?: string;
  anomaly_detected?: boolean;
  monitor_summary?: string;
  monitoring?: unknown;
  monitor_result?: unknown;
  input_data?: unknown;
  output_data?: unknown;
}

// ------------------------------

export default function MonitorAgentDashboard() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const [agentFilter, setAgentFilter] = useState<string | undefined>(undefined);
  const [riskFilter, setRiskFilter] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);

  useEffect(() => {
    const storedData = localStorage.getItem("phqStepData");
    if (storedData) {
      const { userId, nickname } = JSON.parse(storedData);
      setUserId(userId);
      setNickname(nickname);
    }
  }, []);

  // Fetch events
  async function fetchEvents() {
    if (!userId) return;

    try {
      setLoading(true);

      const res = await fetch(
        `${API_BASE}/monitor-agent/get-session-events?user_id=${userId}`
      );
      const data = await res.json();

      const normalized: EventRecord[] = (data.events || []).map(
        (e: EventRecord) => ({
          ...e,
          timestamp: e.timestamp ? new Date(e.timestamp) : null,
          risk_level:
            e.risk_level || (e.monitor_summary && e.risk_level) || "low",
        })
      );

      setEvents(normalized.reverse());
    } catch (err) {
      console.error("fetchEvents", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userId) fetchEvents();
  }, [userId]);

  // Agent list
  const agents = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.agent_name))).filter(Boolean);
  }, [events]);

  // Stats
  const stats = useMemo(() => {
    const total = events.length;
    const anomalies = events.filter((e) => e.anomaly_detected).length;

    const byRisk = { low: 0, medium: 0, high: 0 };
    events.forEach((e) => {
      const r = (e.risk_level || "low").toLowerCase() as
        | "low"
        | "medium"
        | "high";
      byRisk[r] = (byRisk[r] || 0) + 1;
    });

    return { total, anomalies, byRisk };
  }, [events]);

  const pieData = [
    { name: "Low", value: stats.byRisk.low },
    { name: "Medium", value: stats.byRisk.medium },
    { name: "High", value: stats.byRisk.high },
  ];

  // Risk tag UI
  function riskTag(risk?: string) {
    const r = (risk || "low").toLowerCase();
    const color = r === "high" ? "red" : r === "medium" ? "orange" : "green";
    return <Tag color={color}>{r.toUpperCase()}</Tag>;
  }

  function openDrawer(record: EventRecord) {
    setSelectedEvent(record);
    setDrawerVisible(true);
  }

  // Filters
  const filteredEvents = events.filter((e) => {
    if (agentFilter && e.agent_name !== agentFilter) return false;
    if (riskFilter && (e.risk_level || "").toLowerCase() !== riskFilter)
      return false;

    if (searchText) {
      const hay = `${e.agent_name} ${JSON.stringify(
        e.input_data
      )} ${JSON.stringify(e.output_data)} ${
        e.monitor_summary || ""
      }`.toLowerCase();

      if (!hay.includes(searchText.toLowerCase())) return false;
    }

    return true;
  });

  // Table Columns
  const columns: any[] = [
    {
      title: "Timestamp",
      dataIndex: "timestamp",
      render: (t: Date | string | null) =>
        t ? new Date(t).toLocaleString() : "-",
      sorter: (a: EventRecord, b: EventRecord) =>
        new Date(a.timestamp || 0).getTime() -
        new Date(b.timestamp || 0).getTime(),
      defaultSortOrder: "descend",
    },
    {
      title: "Agent",
      dataIndex: "agent_name",
      filters: agents.map((a) => ({ text: a, value: a })),
      onFilter: (value: string, record: EventRecord) =>
        record.agent_name === value,
    },
    {
      title: "Summary",
      dataIndex: "monitor_summary",
      render: (t: string) => (
        <div
          style={{
            maxWidth: 350,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {t || <i>—</i>}
        </div>
      ),
    },
    {
      title: "Risk",
      dataIndex: "risk_level",
      render: (r: string) => riskTag(r),
      filters: [
        { text: "Low", value: "low" },
        { text: "Medium", value: "medium" },
        { text: "High", value: "high" },
      ],
      onFilter: (value: string, record: EventRecord) =>
        (record.risk_level || "").toLowerCase() === value,
    },
    {
      title: "Anomaly",
      dataIndex: "anomaly_detected",
      render: (a: boolean) =>
        a ? (
          <Badge status="error" text="Yes" />
        ) : (
          <Badge status="success" text="No" />
        ),
      filters: [
        { text: "Yes", value: "yes" },
        { text: "No", value: "no" },
      ],
      onFilter: (value: string, record: EventRecord) =>
        value === "yes" ? record.anomaly_detected : !record.anomaly_detected,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          AI Agent Monitoring Dashboard - {nickname}{" "}
        </Typography.Title>
      </div>
        <Spin spinning={loading} tip="Loading events...">

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {/* Total Events */}
        <Col xs={24} sm={12} md={8}>
          <Card
            style={{
              borderLeft: "5px solid #1677ff",
              height: 150,
              display: "flex",
              alignItems: "center",
            }}
          >
            <Statistic
              title={
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <RadarChartOutlined style={{ color: "#1677ff" }} />
                  Total Events
                </span>
              }
              value={stats.total}
            />
          </Card>
        </Col>

        {/* Anomalies */}
        <Col xs={24} sm={12} md={8}>
          <Card
            style={{
              borderLeft: "5px solid #faad14",
              height: 150,
              display: "flex",
              alignItems: "center",
            }}
          >
            <Statistic
              title={
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ExclamationCircleOutlined style={{ color: "#faad14" }} />
                  Anomalies
                </span>
              }
              value={stats.anomalies}
            />
          </Card>
        </Col>

        {/* High Risk */}
        <Col xs={24} sm={24} md={8}>
          <Card
            style={{
              borderLeft: "5px solid #ff4d4f",
              height: 150,
              display: "flex",
              alignItems: "center",
            }}
          >
            <Statistic
              title={
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <WarningOutlined style={{ color: "#ff4d4f" }} />
                  Risk: High
                </span>
              }
              value={stats.byRisk.high}
            />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24}>
          <Card title="Risk Distribution" style={{ height: 300 }}>
            {stats.total === 0 ? (
              <Empty description="No data" />
            ) : (
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={80}
                      label
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                    />
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
          </Space>

          <Space>
            <Button
              onClick={() => {
                setSearchText("");
                setAgentFilter(undefined);
                setRiskFilter(undefined);
              }}
            >
              Reset
            </Button>
            <Button type="primary" onClick={fetchEvents}>
              Refresh
            </Button>
          </Space>
        </Space>
      </Card>

      <Card>
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
      </Card>

      <Drawer
       title={
  selectedEvent
    ? `${selectedEvent.agent_name} Agent - ${selectedEvent.risk_level?.toUpperCase() || "N/A"} Risk`
    : "Event details"
}

        visible={drawerVisible}
        width={720}
        onClose={() => setDrawerVisible(false)}
      >
        {selectedEvent ? (
          <>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Timestamp">
                {selectedEvent.timestamp
                  ? new Date(selectedEvent.timestamp).toLocaleString()
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Agent">
                {selectedEvent.agent_name}
              </Descriptions.Item>
              <Descriptions.Item label="Session/User">
                {`${selectedEvent.session_id || "-"} / ${
                  selectedEvent.user_id || "-"
                }`}
              </Descriptions.Item>
              <Descriptions.Item label="Risk">
                {riskTag(selectedEvent.risk_level)}
              </Descriptions.Item>
              <Descriptions.Item label="Anomaly Detected">
                {selectedEvent.anomaly_detected ? "Yes" : "No"}
              </Descriptions.Item>
              <Descriptions.Item label="Summary">
                {selectedEvent.monitor_summary || "—"}
              </Descriptions.Item>
            </Descriptions>

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
                color={
                  (e.risk_level || "low").toLowerCase() === "high"
                    ? "red"
                    : (e.risk_level || "low").toLowerCase() === "medium"
                    ? "orange"
                    : "green"
                }
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <b>{e.agent_name}</b>
                    <div style={{ fontSize: 12 }}>
                      {e.monitor_summary ||
                        (typeof e.output_data === 'string' 
                          ? e.output_data 
                          : JSON.stringify(e.output_data).slice(0, 120))}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 160 }}>
                    <div style={{ fontSize: 12 }}>
                      {e.timestamp
                        ? new Date(e.timestamp).toLocaleString()
                        : "-"}
                    </div>
                    <div>{riskTag(e.risk_level)}</div>
                  </div>
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Card>
    </Spin>
    </div>
  );
}
