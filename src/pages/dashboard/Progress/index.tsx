import React, { useEffect, useState } from "react";
import { Card, Typography, Spin, Steps, Drawer } from "antd";
import { CheckCircleTwoTone, ClockCircleTwoTone } from "@ant-design/icons";
import axios from "axios";

const { Step } = Steps;
const { Text } = Typography;

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

interface StepBase {
  title: string;
  eventKey: string;
  output_data?: Record<string, any>;
}

interface StepPHQ extends StepBase {
  phqEvent: SessionEvent;
}

type StepData = StepBase | StepPHQ;

const isPHQStep = (step: StepData): step is StepPHQ =>
  (step as StepPHQ).phqEvent !== undefined;

const agents: Agent[] = [
  { name: "Assessment Agent", key: "assessment" },
  { name: "Classifier Agent", key: "classifier" },
  { name: "Therapy Agent", key: "therapy" },
];

const WorkflowPipeline: React.FC = () => {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [agentEvents, setAgentEvents] = useState<
    Record<string, SessionEvent[]>
  >({});
  const [selectedAgent, setSelectedAgent] = useState<string>("assessment");
  const [userId, setUserId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerAgent, setDrawerAgent] = useState<string | null>(null);
// Inside WorkflowPipeline component

const [overflowAgents, setOverflowAgents] = useState<Record<string, boolean>>({});

useEffect(() => {
  // After events are loaded, check which agent cards overflow
  const newOverflow: Record<string, boolean> = {};
  agents.forEach((agent) => {
    const el = document.getElementById(`scroll-${agent.key}`);
    if (el) {
      newOverflow[agent.key] = el.scrollHeight > el.clientHeight;
    }
  });
  setOverflowAgents(newOverflow);
}, [events]);

  const agentMapping: Record<string, string> = {
    chat: "assessment",
    classifier: "classifier",
    therapy: "therapy",
  };

  useEffect(() => {
    const storedData = localStorage.getItem("phqStepData");
    if (storedData) {
      const { userId, sessionId } = JSON.parse(storedData);
      setUserId(userId);
      setSessionId(sessionId);
    }
  }, []);

  useEffect(() => {
    if (!userId || !sessionId) return;

    const fetchEvents = async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `http://localhost:8000/monitor-agent/get-session-events?user_id=${userId}`
        );

        setEvents(res.data.events);
        const grouped: Record<string, SessionEvent[]> = {};
        res.data.events.forEach((e: SessionEvent) => {
          const rawName = e.agent_name?.toLowerCase() || "unknown";
          const agentKey = agentMapping[rawName] || "unknown";
          if (!grouped[agentKey]) grouped[agentKey] = [];
          grouped[agentKey].push(e);
        });
        setAgentEvents(grouped);

        for (const agent of agents) {
          const steps = getAgentSteps(agent.key, grouped);
          const activeStepIndex = steps.findIndex(
            (s) => getStepStatus(s, agent.key, grouped) === "process"
          );
          if (activeStepIndex !== -1) {
            setSelectedAgent(agent.key);
            break;
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [userId, sessionId]);

  if (!userId || !sessionId) return <div>No session selected.</div>;
  if (loading)
    return (
      <Spin size="large" tip="Loading workflow..." style={{ margin: 50 }} />
    );

  const getAgentSteps = (
    agentKey: string,
    grouped: Record<string, SessionEvent[]> = agentEvents
  ): StepData[] => {
    const evts = grouped[agentKey] || [];
    switch (agentKey) {
      case "assessment":
        return [
          { title: "Session Started", eventKey: "session_started" },
          { title: "Initial Chat", eventKey: "initial" },
          ...evts
            .filter((e) => e.output_data?.phq9_questionID)
            .map((e) => ({
              title: `PHQ Q${e.output_data?.phq9_questionID}`,
              eventKey: `phq_question_${e.output_data?.phq9_questionID}`,
              phqEvent: e,
            })),
          { title: "Follow-up", eventKey: "followup" },
          { title: "Session Ended", eventKey: "session_ended" },
        ];
      case "classifier":
        return evts.map((e, idx) => ({
          title: `Detection ${idx + 1}`,
          eventKey: `detection_${idx}`,
          output_data: e.output_data,
        }));
      case "therapy":
        return evts.map((e, idx) => ({
          title: `Therapy Step ${idx + 1}`,
          eventKey: `therapy_${idx}`,
          output_data: e.output_data,
        }));
      default:
        return [];
    }
  };

  const getStepStatus = (
    step: StepData,
    agentKey: string,
    grouped: Record<string, SessionEvent[]> = agentEvents
  ) => {
    const evts = grouped[agentKey] || [];
    if (step.eventKey === "session_started") return "finish";
    if (step.eventKey === "session_ended")
      return evts.some((e) => e.event?.toLowerCase() === "session_ended")
        ? "finish"
        : "wait";
    if (isPHQStep(step))
      return step.phqEvent.output_data?.phq9_completed ? "finish" : "process";
    if (step.output_data) return "finish";
    return evts.some((e) => e.event?.toLowerCase().includes(step.eventKey))
      ? "finish"
      : "wait";
  };

  const isAgentActive = (agentKey: string) => {
    const steps = getAgentSteps(agentKey);
    return steps.some((s) => getStepStatus(s, agentKey) === "process");
  };

  const openDrawerForAgent = (agentKey: string) => {
    setDrawerAgent(agentKey);
    setDrawerOpen(true);
  };

  const CARD_HEIGHT = 400;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 20,
        padding: 20,
        overflowX: "auto",
      }}
    >
      {agents.map((agent, idx) => {
        const steps = getAgentSteps(agent.key);
        const activeStepIndex = steps.findIndex(
          (s) => getStepStatus(s, agent.key) === "process"
        );
        const isCurrent = selectedAgent === agent.key;
        const agentActive = isAgentActive(agent.key);

        return (
          <div
            key={agent.key}
            style={{ display: "flex", alignItems: "center" }}
          >
            <Card
              title={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {agentActive ? (
                    <ClockCircleTwoTone twoToneColor="#52c41a" />
                  ) : (
                    <CheckCircleTwoTone twoToneColor="#d9d9d9" />
                  )}
                  <span>{agent.name}</span>
                </div>
              }
              bordered
              style={{
                borderColor: isCurrent ? "#1890ff" : undefined,
                borderWidth: isCurrent ? 2 : 1,
                width: 250,
                height: CARD_HEIGHT,
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              <div
                id={`scroll-${agent.key}`}
                style={{
                  maxHeight: CARD_HEIGHT - 120,
                  overflow: "hidden",
                  flex: 1,
                  paddingRight: 5,
                }}
              >
                <Steps
                  direction="vertical"
                  current={
                    activeStepIndex !== -1 ? activeStepIndex : steps.length - 1
                  }
                >
                  {steps.map((step, sIdx) => (
                    <Step
                      key={sIdx}
                      title={step.title}
                      status={getStepStatus(step, agent.key)}
                      description={
                        isPHQStep(step) ? (
                          <Text type="secondary">
                            {new Date(
                              step.phqEvent.timestamp + "Z"
                            ).toLocaleString("en-GB", {
                              timeZone: "Asia/Colombo",
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </Text>
                        ) : step.output_data ? (
                          <Text>
                            {step.output_data.depression_label ??
                              step.output_data.emotion}
                          </Text>
                        ) : null
                      }
                    />
                  ))}
                </Steps>
              </div>

             {overflowAgents[agent.key] && (
  <div
    style={{
      textAlign: "center",
      marginTop: 5,
      cursor: "pointer",
      fontSize: 12,
      color: "#1890ff",
    }}
    onClick={() => openDrawerForAgent(agent.key)}
  >
    View All
  </div>
)}

            </Card>

            {idx < agents.length - 1 && (
              <div style={{ fontSize: 24, margin: "0 10px" }}>➡️</div>
            )}
          </div>
        );
      })}

      <Drawer
        title={
          drawerAgent ? agents.find((a) => a.key === drawerAgent)?.name : ""
        }
        placement="right"
        width={500}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {drawerAgent && (
          <Steps
            direction="vertical"
            current={getAgentSteps(drawerAgent).findIndex(
              (s) => getStepStatus(s, drawerAgent) === "process"
            )}
          >
            {getAgentSteps(drawerAgent).map((step, sIdx) => (
              <Step
                key={sIdx}
                title={step.title}
                status={getStepStatus(step, drawerAgent)}
                description={
                  isPHQStep(step) ? (
                    <Text type="secondary">
                      {step.phqEvent.output_data?.phq9_question}
                    </Text>
                  ) : step.output_data ? (
                    <Text>
                      {step.output_data.depression_label ??
                        step.output_data.emotion}
                    </Text>
                  ) : null
                }
              />
            ))}
          </Steps>
        )}
      </Drawer>
    </div>
  );
};

export default WorkflowPipeline;
