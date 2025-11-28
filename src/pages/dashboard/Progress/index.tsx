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
  children?: StepData[];
  phqEvent?: SessionEvent;
  input_data?: Record<string, any>;
  timestamp?: string;
  status?: "wait" | "process" | "finish";
}

type StepData = StepBase;

const agents: Agent[] = [
  { name: "Assessment Agent", key: "assessment" },
  { name: "Classifier Agent", key: "classifier" },
  { name: "Therapy Agent", key: "therapy" },
];

const DRAWER_WIDTH = 500;
const CARD_HEIGHT = 320;

const WorkflowPipeline: React.FC = () => {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [agentEvents, setAgentEvents] = useState<Record<string, SessionEvent[]>>({});
  const [selectedAgent, setSelectedAgent] = useState<string>("assessment");
  const [userId, setUserId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerAgent, setDrawerAgent] = useState<string | null>(null);
  const [overflowAgents, setOverflowAgents] = useState<Record<string, boolean>>({});
  const [phqExpanded, setPhqExpanded] = useState<boolean>(false);
  const stepsRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
      setOverflowAgents(newOverflow);
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [agentEvents]);

  if (!userId || !sessionId) return <div>No session selected.</div>;
  if (loading) return <Spin size="large" tip="Loading workflow..." style={{ margin: 50 }} />;

  const getAgentSteps = (agentKey: string, grouped: Record<string, SessionEvent[]> = agentEvents): StepData[] => {
    const evts = grouped[agentKey] || [];
    switch (agentKey) {
      case "assessment": {
        const phqEvents = evts.filter(
          (e) => (e.output_data?.phq9_questionID !== undefined) || e.phq9_questionID !== undefined
        );
        const hasStarted = phqEvents.some((e) => (e.output_data?.phq9_questionID === 1) || e.phq9_questionID === 1);
        const completed = phqEvents.some((e) => (e.output_data?.phq9_completed === true) || e.phq9_completed === true);

        const children: StepData[] = phqEvents
          .sort((a, b) => (a.output_data?.phq9_questionID ?? a.phq9_questionID ?? 0) - (b.output_data?.phq9_questionID ?? b.phq9_questionID ?? 0))
          .map((e) => ({ title: `PHQ Q${e.output_data?.phq9_questionID ?? e.phq9_questionID ?? -1}`, eventKey: `phq_q_${e.phq9_questionID}`, phqEvent: e, timestamp: e.timestamp }));
        const firstEventTimestamp = evts[0]?.timestamp;
        return [
          { title: "Session Started", eventKey: "session_started", timestamp: firstEventTimestamp },
          { title: "Initial Chat", eventKey: "initial", timestamp: evts[1]?.timestamp ?? firstEventTimestamp },
          { title: completed ? "PHQ-9 Completed" : hasStarted ? "PHQ-9 In Progress" : "PHQ-9 Not Started", eventKey: "phq_main", children },
          {
            title: "Follow-up", eventKey: "followup", timestamp: evts.find(e => e.event === "followup")?.timestamp
          },
        ];
      }

      case "classifier": {
        const evts = grouped[agentKey] || [];

        const sessionEvent = evts.find(
          (e) => e.output_data?.event === "session_end"
        );

        const detectionEvent = evts.find(
          (e) => e.output_data?.event === "depression_detection"
        );

        return [
          {
            title: "Session Ended",
            eventKey: "session_ended",
            timestamp: sessionEvent?.timestamp,
            output_data: undefined
          },
          {
            title: "Level Detection",
            eventKey: "level_detection",
            timestamp: detectionEvent?.timestamp,
            output_data: detectionEvent?.output_data
          }
        ];
      }

      case "therapy": {
        const evts = (grouped[agentKey] || [])
          .filter(e => e.session_id === sessionId)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Group therapy cycles by therapy_name
        const therapyGroups: Record<string, SessionEvent[]> = {};

        evts.forEach(e => {
          const tname =
            e.output_data?.therapy_name ||
            e.input_data?.therapy_name ||
            "Therapy";

          if (!therapyGroups[tname]) therapyGroups[tname] = [];
          therapyGroups[tname].push(e);
        });

        // Build steps dynamically for each therapy cycle
        const allTherapySteps: StepData[] = [];

        let therapyIndex = 1;
        for (const [therapyName, tEvents] of Object.entries(therapyGroups)) {

          const suggested = tEvents.find(e =>
            (e.input_data?.event ?? e.event) === "THERAPY_SUGGESTED"
          );
          const started = tEvents.find(e =>
            (e.input_data?.event ?? e.event) === "THERAPY_STARTED"
          );
          const inProgress = tEvents.filter(e =>
            (e.input_data?.event ?? e.event) === "THERAPY_IN_PROGRESS"
          );
          const ended = tEvents.find(e =>
            (e.input_data?.event ?? e.event) === "THERAPY_ENDED"
          );
          console.log(started)

          allTherapySteps.push({
            title: `Therapy ${therapyIndex}: ${therapyName}`,
            eventKey: `therapy_${therapyIndex}`,
            children: [
              {
                title: "Suggested",
                eventKey: `therapy_${therapyIndex}_suggested`,
                timestamp: suggested?.timestamp,
                status: suggested ? "finish" : "wait",
              },
              {
                title: "Started",
                eventKey: `therapy_${therapyIndex}_started`,
                timestamp: started?.timestamp,
                status: started ? "finish" : suggested ? "process" : "wait",
              },
              {
                title: "Progress",
                eventKey: `therapy_${therapyIndex}_progress`,
                children: inProgress.map((p, i) => ({
                  title: `Progress Update ${i + 1}`,
                  eventKey: `therapy_${therapyIndex}_progress_${i}`,
                  timestamp: p.timestamp,
                  output_data: p.output_data,
                })),
                status: ended ? "finish" : started ? "process" : "wait",
              },
              {
                title: "Completed",
                eventKey: `therapy_${therapyIndex}_completed`,
                timestamp: ended?.timestamp,
                output_data: ended?.output_data,
                status: ended ? "finish" : "wait",
              }
            ]
          });

          therapyIndex++;
        }

        return allTherapySteps;
      }



      default: return [];
    }
  };


  const getStepStatus = (step: StepData, agentKey: string, grouped: Record<string, SessionEvent[]> = agentEvents) => {
    const evts = grouped[agentKey] || [];
    if (step.eventKey === "session_started" || step.eventKey === "initial") return "finish";
    if (step.eventKey === "session_ended") {
      return evts.some(
        (e) => e.output_data?.event === "session_end"
      )
        ? "finish"
        : "wait";
    }
    if (step.eventKey === "phq_main") {
      const phqEvents = evts.filter((e) => (e.output_data?.phq9_questionID !== undefined) || e.phq9_questionID !== undefined);
      if (!phqEvents.length) return "wait";
      return phqEvents.some((e) => (e.output_data?.phq9_completed === true) || e.phq9_completed === true) ? "finish" : "process";
    }
    if (step.phqEvent) return "finish";
    if (step.output_data) return "finish";
    if (evts.some((e) => e.event?.toLowerCase().includes(step.eventKey))) return "finish";
    return "wait";
  };

  const isAgentActive = (agentKey: string) => getAgentSteps(agentKey).some((s) => getStepStatus(s, agentKey) === "process");

  const openDrawerForAgent = (agentKey: string) => {
    setDrawerAgent(agentKey);
    setDrawerOpen(true);
    setPhqExpanded(false); // default collapsed
  };

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts + "Z").toLocaleString("en-GB", { timeZone: "Asia/Colombo", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
      return ts;
    }
  };

  return (
    <div style={{ display: "flex", width: "100%", gap: 20, flexDirection: "column" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Visualizing Multi-Agent Workflow Progress in Real-Time - {nickname}
        </Typography.Title>
      </div>

      <div style={{ display: "flex", width: "100%", gap: 20 }}>
        <div style={{ flex: "1", display: "flex", flexDirection: "column", gap: 40, position: "relative" }}>
          <div style={{ width: 2, background: "#d9d9d9", height: "100%", position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)" }} />
          {agents.map((agent, idx) => {
            const steps = getAgentSteps(agent.key);
            const activeStepIndex = steps.findIndex((s) => getStepStatus(s, agent.key) === "process");
            const isLeft = idx % 2 === 0;
            const agentActive = isAgentActive(agent.key);

            return (
              <div key={agent.key} style={{ width: "100%", display: "flex", justifyContent: isLeft ? "flex-start" : "flex-end", alignItems: "center", position: "relative", gap: 20 }}>
                <Card
                  title={
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {agentActive ? <ClockCircleTwoTone twoToneColor="#52c41a" /> : <CheckCircleTwoTone twoToneColor="#d9d9d9" />}
                      <span>{agent.name}</span>
                    </div>
                  }
                  bordered
                  style={{ width: 300, height: CARD_HEIGHT, borderColor: selectedAgent === agent.key ? "#1890ff" : undefined, borderWidth: selectedAgent === agent.key ? 2 : 1 }}
                >
                  <div style={{ maxHeight: CARD_HEIGHT - 120, overflow: "hidden" }} ref={(el) => void (stepsRefs.current[agent.key] = el)}>
                    <Steps direction="vertical" current={activeStepIndex !== -1 ? activeStepIndex : steps.length - 1}>
                      {steps.map((step, sIdx) => (
                        <Step
                          key={sIdx}
                          title={step.title}
                          status={getStepStatus(step, agent.key)}
                          description={
                            <div>
                              {step.timestamp && (
                                <Text type="secondary">{formatTimestamp(step.timestamp)}</Text>
                              )}

                              {/* therapy child events (suggested, started, progress, ended) */}
                              {step.children && (
                                <div style={{ marginTop: 6, paddingLeft: 10 }}>
                                  {step.children.map((child, cIdx) => (
                                    <div key={cIdx} style={{ marginBottom: 5 }}>
                                      <Text strong>{child.title}</Text>
                                      <br />
                                      {child.timestamp && (
                                        <Text type="secondary">{formatTimestamp(child.timestamp)}</Text>
                                      )}
                                     
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          }
                        />
                      ))}
                    </Steps>
                  </div>
                  {(agent.key === "assessment" || agent.key === "therapy") && <div style={{ textAlign: "center", marginTop: 5, cursor: "pointer", fontSize: 12, color: "#1890ff" }} onClick={() => openDrawerForAgent(agent.key)}>View All</div>}
                </Card>
              </div>
            );
          })}
        </div>
        {drawerOpen && drawerAgent && (
          <div style={{ width: DRAWER_WIDTH, borderLeft: "1px solid #d9d9d9", paddingLeft: 16, overflowY: "auto" }}>
            <Card
              title={agents.find((a) => a.key === drawerAgent)?.name}
              size="small"
              extra={<span style={{ cursor: "pointer", color: "#1890ff", fontWeight: "bold" }} onClick={() => setDrawerOpen(false)}>×</span>}
            >
              <Steps direction="vertical" current={getAgentSteps(drawerAgent).findIndex((s) => getStepStatus(s, drawerAgent) === "process")}>
                {getAgentSteps(drawerAgent).map((step, sIdx) => {
                  if (step.eventKey === "phq_main") {
                    return (
                      <Step
                        key={sIdx}
                        title={<div style={{ cursor: "pointer" }} onClick={() => setPhqExpanded((prev) => !prev)}>{step.title} {phqExpanded ? "▼" : "▶"}</div>}
                        status={getStepStatus(step, drawerAgent)}
                        description={phqExpanded ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {step.children
                              ?.filter((sub) => sub.phqEvent?.output_data?.phq9_started === true || sub.phqEvent?.phq9_started === true)
                              .map((sub, subIdx) => {
                                const ts = sub.phqEvent?.timestamp;
                                const label = sub.phqEvent?.output_data?.phq9_questionID ?? sub.phqEvent?.phq9_questionID;
                                return (
                                  <div key={subIdx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 6 }}>
                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                      <Text strong style={{ fontSize: 13 }}>{`PHQ-${label}`}</Text>
                                      <Text type="secondary" style={{ fontSize: 12 }}>{ts ? formatTimestamp(ts) : ""}</Text>
                                    </div>
                                    <div>
                                      {getStepStatus(sub, drawerAgent) === "finish" ? <CheckCircleTwoTone twoToneColor="#52c41a" /> : <ClockCircleTwoTone twoToneColor="#d9d9d9" />}
                                    </div>
                                  </div>
                                );
                              })}

                          </div>
                        ) : null}
                      />
                    );
                  }

                  return (
                    <Step
                      key={sIdx}
                      title={step.title}
                      status={getStepStatus(step, drawerAgent)}
                      description={
                        <div>
                          {/* timestamp */}
                          {step.timestamp && (
                            <Text type="secondary">{formatTimestamp(step.timestamp)}</Text>
                          )}

                          {/* therapy children */}
                          {step.children && (
                            <div style={{ marginTop: 8, paddingLeft: 12 }}>
                              {step.children.map((child, cIdx) => (
                                <div key={cIdx} style={{ marginBottom: 8 }}>
                                  <Text strong>{child.title}</Text>
                                  <br />
                                  {child.timestamp && (
                                    <Text type="secondary">
                                      {formatTimestamp(child.timestamp)}
                                    </Text>
                                  )}

                                
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      }
                    />
                  );

                })}
              </Steps>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowPipeline;
