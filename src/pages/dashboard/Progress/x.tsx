import React, { useEffect, useState } from "react";
import { Card, Typography, Spin, Drawer, Steps } from "antd";
import { CheckCircleTwoTone, ClockCircleTwoTone } from "@ant-design/icons";
import axios from "axios";

const { Text, Title } = Typography;
const { Step } = Steps;

interface SessionEvent {
  event?: string;
  timestamp: string;
  agent_name?: string;
  phq9_questionID?: number;
  phq9_question?: string;
  phq9_completed?: boolean;
  phq9_started?: boolean;
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  user_id: number;
  session_id: number;
}

interface Agent {
  name: string;
  key: string;
}

const agents: Agent[] = [
  { name: "Assessment Agent", key: "assessment" },
  { name: "Classifier Agent", key: "classifier" },
  { name: "Therapy Agent", key: "therapy" },
];

const WorkflowDashboard: React.FC = () => {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [agentEvents, setAgentEvents] = useState<Record<string, SessionEvent[]>>({});
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [nickname, setNickname] = useState<string>("");
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerAgent, setDrawerAgent] = useState<string>("");

  const agentMapping: Record<string, string> = {
    chat: "assessment",
    classifier: "classifier",
    therapy: "therapy",
  };

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("phqStepData") || "{}");
    if (stored.userId) {
      setUserId(stored.userId);
      setSessionId(stored.sessionId);
      setNickname(stored.nickname);
    }
  }, []);

  useEffect(() => {
    if (!userId || !sessionId) return;

    const fetchEvents = async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          `http://localhost:8000/monitor-agent/get-session-events?user_id=${userId}`
        );

        setEvents(res.data.events);

        const grouped: Record<string, SessionEvent[]> = {};
        res.data.events.forEach((e: SessionEvent) => {
          const key = agentMapping[e.agent_name?.toLowerCase() || "unknown"] || "unknown";
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(e);
        });

        setAgentEvents(grouped);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [userId, sessionId]);

  const getStepStatus = (step: SessionEvent) =>
    step.phq9_completed ? "finish" : step.phq9_started ? "process" : "wait";

  const openDrawer = (agentKey: string) => {
    setDrawerAgent(agentKey);
    setDrawerVisible(true);
  };

  if (loading) return <Spin size="large" tip="Loading..." style={{ margin: 50 }} />;

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ textAlign: "center", marginBottom: 30 }}>
        Multi-Agent Workflow Dashboard — {nickname}
      </Title>

      {/* Top Row Cards */}
      <div style={{ display: "flex", gap: 24, justifyContent: "center", marginBottom: 30 }}>
        {agents.map((agent) => {
          const steps = agentEvents[agent.key] || [];
          const completedSteps = steps.filter((s) => getStepStatus(s) === "finish").length;
          const progressPercent = steps.length ? Math.round((completedSteps / steps.length) * 100) : 0;

          return (
            <Card
              key={agent.key}
              hoverable
              style={{ width: 300, cursor: "pointer" }}
              onClick={() => openDrawer(agent.key)}
              title={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Text strong>{agent.name}</Text>
                  {progressPercent === 100 ? (
                    <CheckCircleTwoTone twoToneColor="#52c41a" />
                  ) : (
                    <ClockCircleTwoTone twoToneColor="#d9d9d9" />
                  )}
                </div>
              }
            >
              <div style={{ marginBottom: 8 }}>
                <Text>{completedSteps} / {steps.length} Steps Completed</Text>
              </div>
              <div style={{ height: 10, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: "100%",
                    background: "#1890ff",
                    borderRadius: 4,
                  }}
                />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Drawer */}
      <Drawer
        title={agents.find((a) => a.key === drawerAgent)?.name}
        placement="right"
        width={500}
        onClose={() => setDrawerVisible(false)}
        visible={drawerVisible}
      >
        {(agentEvents[drawerAgent] || []).map((step, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 0",
              borderBottom: "1px dashed #f0f0f0",
            }}
          >
            <div>
              <Text>{step.event || step.phq9_question || `Step ${idx + 1}`}</Text>
              {step.timestamp && (
                <div style={{ fontSize: 12, color: "#999" }}>
                  {new Date(step.timestamp).toLocaleString()}
                </div>
              )}
            </div>
            <div>
              {getStepStatus(step) === "finish" ? (
                <CheckCircleTwoTone twoToneColor="#52c41a" />
              ) : (
                <ClockCircleTwoTone twoToneColor="#d9d9d9" />
              )}
            </div>
          </div>
        ))}
      </Drawer>
    </div>
  );
};

export default WorkflowDashboard;
