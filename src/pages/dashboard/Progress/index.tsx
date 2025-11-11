import React, { useEffect, useState } from "react";
import { Steps, Typography, Spin } from "antd";
import axios from "axios";

const { Step } = Steps;
const { Text } = Typography;

interface SessionEvent {
  event: string;
  timestamp: string;
  phq9_questionID?: number;
  phq9_question?: string;
  phq9_progress?: number;
  phq9_completed?: boolean;
  phq9_started?: boolean;
  input_data?: {
    user_query?: string;
  };
  output_data?: any;
  user_id: number;
  session_id: number;
}

interface SessionLog {
  user_id: number;
  session_id: number;
  events: SessionEvent[];
}

interface StepBase {
  title: string;
  eventKey: string;
}

interface StepPHQ extends StepBase {
  phqEvent: SessionEvent;
}

type StepData = StepBase | StepPHQ;

const PHQStepsChart: React.FC = () => {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // <-- loading state

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
        const res = await axios.get<SessionLog>(
          `http://localhost:8000/monitor-agent/get-session-events?user_id=${userId}&session_id=${sessionId}`
        );

        setEvents(
          res.data.events.map((e: any) => ({
            ...e.output_data,
            event: e.agent_name || "chat",
            input_data: e.input_data,
            timestamp: e.timestamp,
            user_id: e.user_id,
            session_id: e.session_id,
          }))
        );
      } catch (err) {
        console.error("Failed to fetch session events:", err);
      } finally {
        setLoading(false); 
      }
    };

    fetchEvents();
  }, [userId, sessionId]);

  if (!userId || !sessionId) return <div>No session selected.</div>;

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 50 }}>
        <Spin size="large" tip="Loading session events..." />
      </div>
    );
  }

  const stepsData: StepData[] = [
    { title: "Session Started", eventKey: "session_started" },
    { title: "Initial Chat", eventKey: "chat_initial" },
    { title: "PHQ-9 Started", eventKey: "phq_started" },
    ...events
      .filter((e) => e.phq9_questionID)
      .map((e) => ({
        title: `PHQ-9 Q${e.phq9_questionID}`,
        eventKey: `phq_question_${e.phq9_questionID}`,
        phqEvent: e,
      })),
    { title: "PHQ-9 Finished", eventKey: "phq_finished" },
    { title: "Follow-up Chat", eventKey: "chat_followup" },
    { title: "Session Ended", eventKey: "session_ended" },
  ];

  const isPHQStep = (step: StepData): step is StepPHQ => {
    return (step as StepPHQ).phqEvent !== undefined;
  };

  // ---------------------------
  // Determine status for each step
  // ---------------------------
  const stepStatuses = stepsData.map((step) => {
    if (step.eventKey === "session_started") return "finish";

    if (step.eventKey === "chat_initial") {
      const userSentMessage = events.some(
        (e) =>
          e.input_data?.user_query && e.input_data.user_query.trim().length > 0
      );
      return userSentMessage ? "finish" : "process";
    }

    if (step.eventKey === "phq_started") {
      const phqStarted = events.some((e) => e.phq9_started);
      return phqStarted ? "finish" : "wait";
    }

    if (isPHQStep(step)) {
      const phqEvent = step.phqEvent;
      console.log("Evaluating PHQ Step:", phqEvent);
      return phqEvent.phq9_completed ? "process" : "finish";
    }

    if (step.eventKey === "phq_finished") {
      const phqEnd = events.some((e) => e.phq9_completed);
      return phqEnd ? "finish" : "wait";
    }

    if (step.eventKey === "chat_followup")
      return events.some((e) => e.input_data?.user_query) ? "finish" : "wait";

    if (step.eventKey === "session_ended")
      return events.some((e) => e.event === "session_ended")
        ? "finish"
        : "wait";

    return "wait";
  });

  const activeStepIndex = stepStatuses.findIndex(
    (status) => status === "process"
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>
      <Steps
        direction="vertical"
        current={
          activeStepIndex === -1 ? stepsData.length - 1 : activeStepIndex
        }
      >
        {stepsData.map((step, idx) => {
          const e = isPHQStep(step) ? step.phqEvent : undefined;
          const status = stepStatuses[idx] as "finish" | "process" | "wait";

          return (
            <Step
              key={idx}
              title={step.title}
              status={status}
              description={
                e ? (
                  <>
                    <Text>{e.phq9_question}</Text>
                    <Text
                      type="secondary"
                      style={{ display: "block", marginTop: 4 }}
                    >
                      {new Date(e.timestamp).toLocaleString()}
                    </Text>
                  </>
                ) : null
              }
            />
          );
        })}
      </Steps>
    </div>
  );
};

export default PHQStepsChart;
