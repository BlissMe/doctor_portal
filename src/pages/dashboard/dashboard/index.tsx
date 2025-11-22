import { Card, CardContent } from "@/ui/card";
import { Text, Title } from "@/ui/typography";
import { rgbAlpha } from "@/utils/theme";
import { useEffect, useState } from "react";
import BannerCard from "./banner-card";
import { getItem } from "@/utils/storage";
import { StorageEnum } from "@/types/enum";
import axios from "axios";
import {
  Activity,
  ArrowRightCircle,
  HeartPulse,
  TrendingUp,
  Users,
} from "lucide-react";
import { message, Tag } from "antd";
import { useNavigate } from "react-router";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface User {
  userID: number;
  nickname: string;
  virtualCharacter?: string;
  inputMode?: string;
  depressionLevel?: string;
  level?: string;
  R_value?: number;
  createdAt?: string;
  components?: {
    classifier?: {
      emotion?: string;
    };
  };
  cutoffs?: {
    minimal_max: number;
    moderate_max: number;
  };
  lastSessionID?: string | null;
}

const levelColor = (lvl?: string) => {
  switch ((lvl || "").toLowerCase()) {
    case "minimal":
      return "green";
    case "moderate":
      return "gold";
    case "severe":
      return "red";
    case "pending":
      return "blue";
    default:
      return "default";
  }
};

export default function Workbench() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const apiBase = import.meta.env.VITE_APP_API_BASE_URL2;
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      await fetchAllUsers();
      await fetchLevelDetection();
    };
    loadData();
  }, [apiBase]);

  const fetchAllUsers = async () => {
    setLoading(true);
    const token = getItem(StorageEnum.UserToken);
    try {
      const response = await axios.get<{
        message: string;
        preferences: { users: User[] };
      }>(`${apiBase}/api/blissme/all-preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data.preferences.users || []);
    } catch (error: any) {
      console.error("Error fetching users:", error?.message || error);
      message.error("Failed to fetch users.");
    } finally {
      setLoading(false);
    }
  };

  const fetchLevelDetection = async () => {
    const token = getItem(StorageEnum.UserToken);
    try {
      const res = await axios.get<{
        success: boolean;
        data: {
          userID: number;
          R_value: number;
          level: string;
          createdAt: string;
          components?: { classifier?: { emotion?: string } };
        }[];
      }>(`${apiBase}/levelDetection/all-users-latest-index`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const levelData = res.data.data || [];

      const updatedUsers = await Promise.all(
        levelData.map(async (ld) => {
          try {
            const last = await axios.get<{
              success: boolean;
              sessionID: string | null;
              answeredCount: number;
            }>(`${apiBase}/phq9/last-session/${ld.userID}`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            return {
              ...ld,
              level: ld.level || "pending",
              lastSessionID: last.data.sessionID,
            } as User;
          } catch (err) {
            console.error(
              "Error fetching PHQ9 session for user",
              ld.userID,
              err
            );
          }
          return { ...ld, level: ld.level || "pending" } as User;
        })
      );

      setUsers((prevUsers) =>
        prevUsers.map((user) => {
          const match = updatedUsers.find((u) => u.userID === user.userID);
          return match
            ? {
                ...user,
                level: match.level,
                R_value: match.R_value,
                components: match.components,
                createdAt: match.createdAt,
                lastSessionID: match.lastSessionID,
              }
            : user;
        })
      );
    } catch (error: any) {
      console.error("Error fetching levels:", error?.message || error);
    }
  };

  const getLatestSession = async (userID: number) => {
    try {
      const response = await axios.get<{ sessionID: string | null }>(
        `${apiBase}/session/latest-session`,
        { params: { userID } }
      );
      return response.data;
    } catch {
      return { sessionID: null };
    }
  };

  // Normalize depression levels
  const normalizeLevel = (lvl?: string) => {
    if (!lvl) return "unknown";
    const clean = lvl.toLowerCase().replace(/\s+/g, "");
    if (clean === "mild") return "minimal";
    if (["unknown", "noidea"].includes(clean)) return "unknown";
    return clean;
  };

  // Sorting users: Match → Mismatch → Unknown
  const sortedUsers = [...users].sort((a, b) => {
    const statusRank = (user: User) => {
      const self = normalizeLevel(user.depressionLevel);
      let sys = user.level?.toLowerCase() || "pending";
      if (sys === "pending") sys = "unknown";

      if (self === "unknown" || sys === "unknown") return 2;
      if (self === sys) return 0;
      return 1;
    };

    const rankA = statusRank(a);
    const rankB = statusRank(b);

    // First compare Match → Mismatch → Unknown
    if (rankA !== rankB) return rankA - rankB;

    // If same group → sort by userID
    return a.userID - b.userID;
  });

  const comparisonCounts = sortedUsers.reduce(
    (acc, user) => {
      const selfLevel = normalizeLevel(user.depressionLevel);
      let systemLevel = user.level?.toLowerCase() || "pending";
      if (systemLevel === "pending") systemLevel = "unknown";

      if (selfLevel === "unknown" || systemLevel === "unknown")
        acc.Unknown += 1;
      else if (selfLevel === systemLevel) acc.Match += 1;
      else acc.Mismatch += 1;

      return acc;
    },
    { Match: 0, Mismatch: 0, Unknown: 0 }
  );

  const accuracy =
    comparisonCounts.Match + comparisonCounts.Mismatch > 0
      ? (comparisonCounts.Match /
          (comparisonCounts.Match + comparisonCounts.Mismatch)) *
        100
      : 0;

  const chartData = [
    { name: "Match", value: comparisonCounts.Match },
    { name: "Mismatch", value: comparisonCounts.Mismatch },
    { name: "Unknown", value: comparisonCounts.Unknown },
  ];

  const COLORS = ["#10b981", "#ef4444", "#3b82f6"];

  const filteredUsersForTable = sortedUsers.filter(
    (u) => (u.level?.toLowerCase() || "pending") !== "pending"
  );

  const totalPatients = users.length;
  const severePatients = users.filter(
    (u) => u.level?.toLowerCase() === "severe"
  ).length;
  const moderatePatients = users.filter(
    (u) => u.level?.toLowerCase() === "moderate"
  ).length;
  const minimalPatients = users.filter(
    (u) => u.level?.toLowerCase() === "minimal"
  ).length;

  return (
    <div className="flex flex-col gap-4 w-full">
      <BannerCard />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: "Total Patients",
            value: totalPatients,
            icon: Users,
            color: "#7c3aed",
          },
          {
            title: "Severe Cases",
            value: severePatients,
            icon: HeartPulse,
            color: "#ef4444",
          },
          {
            title: "Moderate Cases",
            value: moderatePatients,
            icon: Activity,
            color: "#f59e0b",
          },
          {
            title: "Minimal Cases",
            value: minimalPatients,
            icon: TrendingUp,
            color: "#10b981",
          },
        ].map((card, i) => (
          <Card key={i} className="flex flex-col justify-between h-full">
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-center gap-2">
                <div
                  className="rounded-lg p-2"
                  style={{ background: rgbAlpha(card.color, 0.12) }}
                >
                  <card.icon size={24} className={`text-[${card.color}]`} />
                </div>
                <Text variant="body2" className="font-semibold">
                  {card.title}
                </Text>
              </div>
              <div className="mt-2">
                <Title as="h3" className="text-2xl font-bold">
                  {card.value}
                </Title>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison and Accuracy Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="flex flex-col p-4">
          <Title as="h4" className="mb-2 font-semibold">
            Comparison Status
          </Title>
          <div className="w-full h-90 border border-white">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={60}
                  label
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex flex-col p-4">
          <Title as="h4" className="mb-2 font-semibold">
            Accuracy
          </Title>
          <div className="w-full h-90 border border-white">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "Match", value: comparisonCounts.Match },
                    { name: "Mismatch", value: comparisonCounts.Mismatch },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={60}
                  label
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col items-center mt-4">
            <p className="text-3xl font-bold text-green-600">
              {accuracy.toFixed(2)}%
            </p>
            <p className="mt-2 text-gray-600">Match / (Match + Mismatch)</p>
          </div>
        </Card>
      </div>

      {/* Users Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-3 flex flex-col p-6">
          <div className="relative h-[500px] w-full overflow-auto">
            <table className="w-full border-collapse">
              <thead className="table-header">
                <tr className="table-row">
                  <th className="table-head">#</th>
                  <th className="table-head">Nickname</th>
                  <th className="table-head">UserID</th>
                  <th className="table-head">System Assessment</th>
                  <th className="table-head">Self Assessment</th>
                  <th className="table-head">Comparison</th>
                  <th className="table-head">Tracker</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {sortedUsers.map((user, index) => {
                  const selfLevel = normalizeLevel(user.depressionLevel);
                  const systemLevel = user.level?.toLowerCase() || "pending";

                  let comparisonStatus = "";
                  if (selfLevel === "unknown") comparisonStatus = "Unknown";
                  else if (selfLevel === systemLevel)
                    comparisonStatus = "Match";
                  else comparisonStatus = "Mismatch";

                  return (
                    <tr key={index} className="table-row">
                      <td className="table-cell">{index + 1}</td>
                      <td className="table-cell">
                        <p
                          className="font-medium text-slate-900 dark:text-slate-50 truncate max-w-[120px]"
                          title={user.nickname}
                        >
                          {user.nickname?.length > 10
                            ? `${user.nickname.slice(0, 10)}...`
                            : user.nickname || "-"}
                        </p>
                      </td>
                      <td className="table-cell">{user.userID}</td>
                      <td className="table-cell">
                        <Tag color={levelColor(user.level)}>
                          {user.level || "Pending"}
                        </Tag>
                      </td>
                      <td className="table-cell">
                        <Tag color={levelColor(selfLevel)}>
                          {selfLevel.charAt(0).toUpperCase() +
                            selfLevel.slice(1)}
                        </Tag>
                      </td>
                      <td className="table-cell">
                        <Tag
                          color={
                            comparisonStatus === "Match"
                              ? "green"
                              : comparisonStatus === "Mismatch"
                              ? "red"
                              : "blue"
                          }
                        >
                          {comparisonStatus}
                        </Tag>
                      </td>
                      <td className="table-cell">
                        <ArrowRightCircle
                          size={28}
                          className="text-blue-500 cursor-pointer hover:text-blue-600 transition-transform hover:scale-110"
                          onClick={async () => {
                            const latest = await getLatestSession(user.userID);
                            if (latest?.sessionID) {
                              localStorage.setItem(
                                "phqStepData",
                                JSON.stringify({
                                  userId: user.userID,
                                  sessionId: latest.sessionID,
                                })
                              );
                              navigate("/tracker");
                            } else {
                              message.info(
                                "No session available for this user."
                              );
                            }
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
