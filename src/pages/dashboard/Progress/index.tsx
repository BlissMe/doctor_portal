import React, { useEffect, useState, useRef } from "react";
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
  phq9_progress?: boolean;
}

interface Agent {
  name: string;
  key: string;
}

interface StepBase {
  title: string;
  eventKey: string;
  output_data?: Record<string, any>;
  children?: StepData[];
  phqEvent?: SessionEvent;
  input_data?: Record<string, any>;
  finished?: boolean;
}

type StepData = StepBase;

const agents: Agent[] = [
  { name: "Assessment Agent", key: "assessment" },
  { name: "Classifier Agent", key: "classifier" },
  { name: "Therapy Agent", key: "therapy" },
];

const CARD_HEIGHT = 320;

const WorkflowPipeline: React.FC = () => {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [agentEvents, setAgentEvents] = useState<
    Record<string, SessionEvent[]>
  >({});
  const [selectedAgent, setSelectedAgent] = useState<string>("assessment");
  const [userId, setUserId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [drawerAgent, setDrawerAgent] = useState<string | null>(null);
  const [phqExpanded, setPhqExpanded] = useState<boolean>(false);
  const stepsRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [drawerVisible, setDrawerVisible] = useState(false);
  const agentMapping: Record<string, string> = {
    chat: "assessment",
    classifier: "classifier",
    therapy: "therapy",
  };

  useEffect(() => {
    const storedData = localStorage.getItem("phqStepData");
    if (storedData) {
      const { userId, sessionId, nickname } = JSON.parse(storedData);
      setUserId(userId);
      setSessionId(sessionId);
      setNickname(nickname);
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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [userId, sessionId]);

  useEffect(() => {
    const checkOverflow = () => {
      const newOverflow: Record<string, boolean> = {};
      agents.forEach((agent) => {
        const el = stepsRefs.current[agent.key];
        newOverflow[agent.key] = el ? el.scrollHeight > el.clientHeight : false;
      });
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
    console.log("Getting steps for agent:", agentKey, evts);

    switch (agentKey) {
      case "assessment": {
        const phqEvents = evts.filter(
          (e) =>
            e.output_data?.phq9_questionID !== undefined ||
            e.phq9_questionID !== undefined
        );

        const started = phqEvents.some(
          (e) => e.output_data?.phq9_started === true || e.phq9_started === true
        );

        const completed = phqEvents.some(
          (e) =>
            e.output_data?.phq9_completed === true || e.phq9_completed === true
        );

        const inProgress = phqEvents.filter(
          (e) => e.output_data?.phq9_progress || e.phq9_progress
        );
        const firstEventTimestamp = evts[0]?.timestamp;

        const children: StepData[] = inProgress
          .sort(
            (a, b) =>
              (a.output_data?.phq9_questionID ?? a.phq9_questionID ?? 0) -
              (b.output_data?.phq9_questionID ?? b.phq9_questionID ?? 0)
          )
          .map((e) => ({
            title: e.output_data?.phq9_question ?? e.phq9_question ?? "-",
            eventKey: `phq_q_${e.phq9_questionID}`,
            phqEvent: e,
          }));

        // NEW: Detect follow-up event
        const followUpEvent = evts.find(
          (e) => e.output_data?.event === "FOLLOWUP_CHAT"
        );

        return [
          {
            title: "Session Started",
            eventKey: "session_started",
            finished: true,
            output_data: {
              started_at: firstEventTimestamp,
            },
          },
          {
            title: "Initial Chat",
            eventKey: "initial",
            finished: true,
            output_data: {
              started_at: firstEventTimestamp,
            },
          },
          {
            title: "PHQ Started",
            eventKey: "phq_started",
            finished: started,
            output_data: started
              ? {
                  started_at: phqEvents[0]?.timestamp,
                }
              : undefined,
          },

          {
            title: "PHQ In Progress",
            eventKey: "phq_main",
            children,
          },
          {
            title: "PHQ Completed",
            eventKey: "phq_completed",
            finished: completed,
            output_data: completed
              ? {
                  started_at: phqEvents[0]?.timestamp,
                }
              : undefined,
          },

          {
            title: "Follow-up",
            eventKey: "followup",
            finished: !!followUpEvent,
            output_data: followUpEvent
              ? {
                  started_at: followUpEvent.timestamp,
                  response: followUpEvent.output_data?.response,
                }
              : undefined,
          },
        ];
      }
      case "classifier": {
        const endEvent = evts.find(
          (e) =>
            e.event === "session_end" ||
            e.output_data?.event === "session_end" ||
            e.output_data?.event === "end_session"
        );

        const detectionEvent = evts.find(
          (e) =>
            e.event === "depression_detection" ||
            e.output_data?.event === "depression_detection"
        );

        return [
          {
            title: "End Session",
            eventKey: "end_session",
            finished: !!endEvent,
            output_data: endEvent
              ? {
                  started_at: endEvent.timestamp,
                }
              : undefined,
          },
          {
            title: "Level Detection",
            eventKey: "depression_detection",
            finished: !!detectionEvent,
            output_data: detectionEvent
              ? {
                  started_at: detectionEvent.timestamp,
                }
              : undefined,
          },
        ];
      }
      case "therapy": {
        const suggestedEvents = evts.filter(
          (e) => (e.input_data?.event || e.event) === "THERAPY_SUGGESTED"
        );
        const therapySteps: StepData[] = suggestedEvents.map((therapy, idx) => {
          const therapyName =
            therapy.output_data?.therapy_name ?? `Therapy ${idx + 1}`;
          const startEvent = evts.find(
            (e) =>
              (e.input_data?.event || e.event) === "THERAPY_STARTED" ||
              e.input_data?.therapy_name === therapyName
          );
          const progressEvent = evts.find(
            (e) =>
              (e.input_data?.event || e.event) === "THERAPY_IN_PROGRESS" ||
              e.input_data?.therapy_name === therapyName
          );
          const completedEvent = evts.find(
            (e) =>
              (e.input_data?.event || e.event) === "THERAPY_ENDED" ||
              e.input_data?.therapy_name === therapyName
          );
          const mainFinished = !!completedEvent;
          return {
            title: therapyName,
            eventKey: `therapy_${idx}`,
            finished: mainFinished,
            children: [
              {
                title: "Therapy Started",
                eventKey: `therapy_${idx}_started`,
                finished: !!startEvent,
                output_data: startEvent
                  ? { started_at: startEvent.timestamp }
                  : undefined,
              },
              {
                title: "Therapy In Progress",
                eventKey: `therapy_${idx}_in_progress`,
                finished: !!progressEvent,
                output_data: progressEvent
                  ? { started_at: progressEvent.timestamp }
                  : undefined,
              },
              {
                title: "Therapy Completed",
                eventKey: `therapy_${idx}_completed`,
                finished: !!completedEvent,
                output_data: completedEvent
                  ? { started_at: completedEvent.timestamp }
                  : undefined,
              },
            ],
            output_data: completedEvent
              ? { started_at: completedEvent.timestamp }
              : undefined,
          };
        });

        return therapySteps;
      }

      default:
        return [];
    }
  };

  const getStepStatus = (step: StepData, agentKey: string) => {
    const evts = agentEvents[agentKey] || [];

    if (step.phqEvent) return "finish";
    if (step.eventKey === "phq_main") {
      const completed = evts.some(
        (e) => e.output_data?.phq9_completed === true
      );
      if (completed) return "finish";

      const started = evts.some(
        (e) =>
          e.output_data?.phq9_questionID !== undefined ||
          e.phq9_questionID !== undefined
      );
      return started ? "process" : "wait";
    }
    const matched = evts.some((e) => {
      const inputEvent = e.event?.toLowerCase();
      const inputDataEvent = e.input_data?.event?.toLowerCase();
      const outputEvent = e.output_data?.event?.toLowerCase();
      const target = step.eventKey.toLowerCase();

      return (
        inputEvent === target ||
        inputDataEvent === target ||
        outputEvent === target
      );
    });

    if (matched || step.finished) return "finish";

    return "wait";
  };

  const isAgentActive = (agentKey: string) =>
    getAgentSteps(agentKey).some(
      (s) => getStepStatus(s, agentKey) === "process"
    );

  const openDrawerForAgent = (agentKey: string) => {
    setDrawerAgent(agentKey);
    setDrawerVisible(true);
    setPhqExpanded(false);
  };

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts + "Z").toLocaleString("en-GB", {
        timeZone: "Asia/Colombo",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return ts;
    }
  };

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        gap: 20,
        flexDirection: "column",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Visualizing Multi-Agent Workflow Progress in Real-Time - {nickname}
        </Typography.Title>
      </div>

      <div style={{ display: "flex", width: "100%", gap: 20 }}>
        <div
          style={{
            display: "flex",
            gap: 24,
            justifyContent: "center",
            marginBottom: 30,
          }}
        >
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
                  style={{
                    width: 300,
                    height: CARD_HEIGHT,
                    borderColor:
                      selectedAgent === agent.key ? "#1890ff" : undefined,
                    borderWidth: selectedAgent === agent.key ? 2 : 1,
                    cursor: "pointer",
                  }}
                  onClick={() => openDrawerForAgent(agent.key)}
                >
                  <div
                    style={{ maxHeight: CARD_HEIGHT - 120, overflow: "hidden" }}
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
                            step.output_data ? (
                              <Text>
                                {step.output_data.started_at
                                  ? formatTimestamp(step.output_data.started_at)
                                  : step.output_data.depression_label ??
                                    step.output_data.emotion ??
                                    JSON.stringify(step.output_data)}
                              </Text>
                            ) : null
                          }
                        />
                      ))}
                    </Steps>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
        {drawerVisible && drawerAgent && (
          <Drawer
            title={agents.find((a) => a.key === drawerAgent)?.name}
            placement="right"
            width={500}
            onClose={() => setDrawerVisible(false)}
            visible={drawerVisible}
          >
            <Steps
              direction="vertical"
              current={getAgentSteps(drawerAgent).findIndex(
                (s) => getStepStatus(s, drawerAgent) === "process"
              )}
            >
              {getAgentSteps(drawerAgent).map((step, sIdx) => {
                if (step.eventKey === "phq_main") {
                  return (
                    <Step
                      key={sIdx}
                      title={
                        <div
                          style={{ cursor: "pointer" }}
                          onClick={() => setPhqExpanded((prev) => !prev)}
                        >
                          {step.title} {phqExpanded ? "▼" : "▶"}
                        </div>
                      }
                      status={getStepStatus(step, drawerAgent)}
                      description={
                        phqExpanded ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            {step.children?.map((sub, subIdx) => {
                              const ts = sub.phqEvent?.timestamp;
                              const questionId =
                                sub.phqEvent?.output_data?.phq9_questionID ??
                                sub.phqEvent?.phq9_questionID;

                              return (
                                <div
                                  key={subIdx}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    paddingLeft: 6,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                    }}
                                  >
                                    <Text strong style={{ fontSize: 13 }}>
                                      {questionId
                                        ? `PHQ9 - ${questionId}`
                                        : "-"}
                                    </Text>
                                    <Text
                                      type="secondary"
                                      style={{ fontSize: 12 }}
                                    >
                                      {ts ? formatTimestamp(ts) : ""}
                                    </Text>
                                  </div>
                                  <div>
                                    {getStepStatus(sub, drawerAgent) ===
                                    "finish" ? (
                                      <CheckCircleTwoTone twoToneColor="#52c41a" />
                                    ) : (
                                      <ClockCircleTwoTone twoToneColor="#d9d9d9" />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null
                      }
                    />
                  );
                }
                if (drawerAgent === "therapy" && step.children) {
                  return (
                    <Step
                      key={sIdx}
                      title={<Text strong>{step.title}</Text>}
                      status={getStepStatus(step, drawerAgent)}
                      description={
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            marginTop: 4,
                          }}
                        >
                          {step.children.map(
                            (sub, subIdx) => (
                              console.log("Rendering therapy sub-step:", sub),
                              (
                                <div
                                  key={subIdx}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    paddingLeft: 10,
                                  }}
                                >
                                  <Text style={{ fontSize: 13, flex: 1 }}>
                                    {sub.title}
                                  </Text>

                                  {getStepStatus(sub, drawerAgent) ===
                                  "finish" ? (
                                    <CheckCircleTwoTone twoToneColor="#52c41a" />
                                  ) : (
                                    <ClockCircleTwoTone twoToneColor="#d9d9d9" />
                                  )}

                                  <Text
                                    type="secondary"
                                    style={{ fontSize: 12 }}
                                  >
                                    {sub.output_data?.started_at
                                      ? formatTimestamp(
                                          sub.output_data.started_at
                                        )
                                      : ""}
                                  </Text>
                                </div>
                              )
                            )
                          )}
                        </div>
                      }
                    />
                  );
                }
                return (
                  <Step
                    key={sIdx}
                    title={step.title}
                    status={getStepStatus(step, drawerAgent)}
                    description={
                      step.output_data ? (
                        <Text>
                          {step.output_data.started_at
                            ? formatTimestamp(step.output_data.started_at)
                            : step.output_data.depression_label ??
                              step.output_data.emotion ??
                              null}
                        </Text>
                      ) : null
                    }
                  />
                );
              })}
            </Steps>
          </Drawer>
        )}
      </div>
    </div>
  );
};

export default WorkflowPipeline;
