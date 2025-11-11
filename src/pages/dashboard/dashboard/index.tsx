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
  User,
  Users,
} from "lucide-react";
import { message, Tag } from "antd";
import { useNavigate } from "react-router";

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
  useEffect(() => {
    const loadData = async () => {
      await fetchAllUsers();
      await fetchLevelDetection();
    };
    loadData();
  }, [apiBase]);
  const navigate = useNavigate();

  const fetchAllUsers = async () => {
    setLoading(true);
    const token = getItem(StorageEnum.UserToken);
    console.log("Fetched token:", token);
    try {
      const response = await axios.get<{
        message: string;
        preferences: { users: User[] };
      }>(`${apiBase}/api/blissme/all-preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("Response from all-preferences:", response);
      const fetched = response.data.preferences.users || [];
      setUsers(fetched);
    } catch (error: any) {
      console.log("Error fetching characters:", error?.message || error);
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
      // not fatal, continue
    }
  };

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
  const getLatestSession = async (userID: number) => {
    try {
      const response = await axios.get<{ sessionID: string | null }>(
        `${apiBase}/session/latest-session`,
        {
          params: { userID }, // ✅ pass userID here
        }
      );
      console.log(response);
      return response.data;
    } catch (err) {
      console.error(`Error fetching latest session for user ${userID}:`, err);
      return { sessionID: null };
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <BannerCard />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex flex-col justify-between h-full">
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2">
              <div
                className="rounded-lg p-2"
                style={{ background: rgbAlpha("#7c3aed", 0.12) }}
              >
                <Users size={24} className="text-purple-600" />
              </div>
              <Text variant="body2" className="font-semibold">
                Total Patients
              </Text>
            </div>
            <div className="mt-2">
              <Title as="h3" className="text-2xl font-bold">
                {totalPatients}
              </Title>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between h-full">
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2">
              <div
                className="rounded-lg p-2"
                style={{ background: rgbAlpha("#ef4444", 0.12) }}
              >
                <HeartPulse size={24} className="text-red-500" />
              </div>
              <Text variant="body2" className="font-semibold">
                Severe Cases
              </Text>
            </div>
            <div className="mt-2">
              <Title as="h3" className="text-2xl font-bold">
                {severePatients}
              </Title>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between h-full">
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2">
              <div
                className="rounded-lg p-2"
                style={{ background: rgbAlpha("#f59e0b", 0.12) }}
              >
                <Activity size={24} className="text-yellow-500" />
              </div>
              <Text variant="body2" className="font-semibold">
                Moderate Cases
              </Text>
            </div>
            <div className="mt-2">
              <Title as="h3" className="text-2xl font-bold">
                {moderatePatients}
              </Title>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between h-full">
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2">
              <div
                className="rounded-lg p-2"
                style={{ background: rgbAlpha("#10b981", 0.12) }}
              >
                <TrendingUp size={24} className="text-green-500" />
              </div>
              <Text variant="body2" className="font-semibold">
                Minimal Cases
              </Text>
            </div>
            <div className="mt-2">
              <Title as="h3" className="text-2xl font-bold">
                {minimalPatients}
              </Title>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-3 flex flex-col p-6">
          <div className="relative h-[500px] w-full flex-shrink-0 overflow-auto rounded-none [scrollbar-width:_thin]">
            <table className="w-full border-collapse">
              <thead className="table-header">
                <tr className="table-row">
                  <th className="table-head">#</th>
                  <th className="table-head">Nickname</th>
                  <th className="table-head">System Assessment</th>
                  <th className="table-head">Self Assessment</th>
                  <th className="table-head">Tracker</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {users.map((user, index) => (
                  <tr key={index} className="table-row">
                    <td className="table-cell">{index + 1}</td>
                    <td className="table-cell">
                      {" "}
                      <p
                        className="font-medium text-slate-900 dark:text-slate-50 truncate max-w-[120px]"
                        title={user.nickname}
                      >
                        {user.nickname
                          ? user.nickname.length > 10
                            ? `${user.nickname.slice(0, 10)}...`
                            : user.nickname
                          : "-"}
                      </p>
                    </td>
                    <td className="table-cell">
                      <Tag color={levelColor(user.level)}>
                        {user.level || "Pending"}
                      </Tag>
                    </td>
                    <td className="table-cell">
                      <Tag color={levelColor(user.depressionLevel)}>
                        {user.depressionLevel || "-"}
                      </Tag>
                    </td>
                    <td className="table-cell">
                      <ArrowRightCircle
                        size={28}
                        className="text-blue-500 cursor-pointer hover:text-blue-600 transition-transform hover:scale-110"
                        onClick={async () => {
                          const latest = await getLatestSession(user.userID);
                          console.log("Latest session:", latest);

                          if (latest?.sessionID) {
                            // Save in localStorage
                            localStorage.setItem(
                              "phqStepData",
                              JSON.stringify({
                                userId: user.userID,
                                sessionId: latest.sessionID,
                              })
                            );
                            navigate("/tracker");
                          } else {
                            message.info("No session available for this user.");
                          }
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
