import React, { useEffect, useState, useRef } from "react";
import { Card, Typography, Spin, Steps } from "antd";
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

const DRAWER_WIDTH = 500;
const CARD_HEIGHT = 320;

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
  const [overflowAgents, setOverflowAgents] = useState<Record<string, boolean>>(
    {}
  );
  const stepsRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  // Fetch session events
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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [userId, sessionId]);

  // Check for overflow
  useEffect(() => {
    const checkOverflow = () => {
      const newOverflow: Record<string, boolean> = {};
      agents.forEach((agent) => {
        const el = stepsRefs.current[agent.key];
        if (el) {
          newOverflow[agent.key] = el.scrollHeight > el.clientHeight;
        }
      });
      setOverflowAgents(newOverflow);
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [agentEvents]);

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

  return (
    <div style={{ display: "flex", width: "100%", gap: 20 }}>
      <div
        style={{
          flex: "1",
          display: "flex",
          flexDirection: "column",
          gap: 40,
          position: "relative",
        }}
      >
        <div
          style={{
            width: 2,
            background: "#d9d9d9",
            height: "100%",
            position: "absolute",
            left: "50%",
            top: 0,
            transform: "translateX(-50%)",
          }}
        />

        {agents.map((agent, idx) => {
          const steps = getAgentSteps(agent.key);
          const activeStepIndex = steps.findIndex(
            (s) => getStepStatus(s, agent.key) === "process"
          );
          const isLeft = idx % 2 === 0;
          const agentActive = isAgentActive(agent.key);

          return (
            <div
              key={agent.key}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: isLeft ? "flex-start" : "flex-end",
                alignItems: "center",
                position: "relative",
                gap: 20,
              }}
            >
              <Card
                title={
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
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
                  width: 300,
                  height: CARD_HEIGHT,
                  borderColor:
                    selectedAgent === agent.key ? "#1890ff" : undefined,
                  borderWidth: selectedAgent === agent.key ? 2 : 1,
                }}
              >
                <div
                  style={{
                    maxHeight: CARD_HEIGHT - 120,
                    overflow: "hidden",
                  }}
                  ref={(el) => void (stepsRefs.current[agent.key] = el)}
                >
                  <Steps
                    direction="vertical"
                    current={
                      activeStepIndex !== -1
                        ? activeStepIndex
                        : steps.length - 1
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
                              })}{" "}
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
            </div>
          );
        })}
      </div>

      {drawerOpen && drawerAgent && (
        <div
          style={{
            width: DRAWER_WIDTH,
            borderLeft: "1px solid #d9d9d9",
            paddingLeft: 16,
            overflowY: "auto",
          }}
        >
          <Card
            title={agents.find((a) => a.key === drawerAgent)?.name}
            size="small"
          >
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
                    isPHQStep(step)
                      ? new Date(step.phqEvent.timestamp + "Z").toLocaleString(
                          "en-GB",
                          {
                            timeZone: "Asia/Colombo",
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          }
                        )
                      : step.output_data
                      ? step.output_data.depression_label ??
                        step.output_data.emotion
                      : null
                  }
                />
              ))}
            </Steps>
          </Card>
        </div>
      )}
    </div>
  );
};

export default WorkflowPipeline;
