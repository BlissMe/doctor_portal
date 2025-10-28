// src/pages/DoctorWorkbench.tsx
import React, { useEffect, useState } from "react";
import {
  Button as AntdButton,
  Input as AntdInput,
  message,
  Modal,
  Progress as AntdProgress,
  Select as AntdSelect,
  Tag as AntdTag,
} from "antd";
import {
  Activity,
  HeartPulse,
  PencilLine,
  TrendingUp,
  Users,
} from "lucide-react";
import axios from "axios";

import avatar1 from "@/assets/images/avatars/avatar-1.png";
import avatar2 from "@/assets/images/avatars/avatar-2.png";
import avatar3 from "@/assets/images/avatars/avatar-3.png";
import avatar4 from "@/assets/images/avatars/avatar-4.png";
import avatar5 from "@/assets/images/avatars/avatar-5.png";

import { Chart, useChart } from "@/components/chart";
import Icon from "@/components/icon/icon";
import { GLOBAL_CONFIG } from "@/global-config";
import { Avatar, AvatarImage } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Text, Title } from "@/ui/typography";
import { rgbAlpha } from "@/utils/theme";

import { getItem } from "@/utils/storage";
import { StorageEnum } from "@/types/enum";

// ---------- Types ----------
interface User {
  userID: number;
  nickname: string;
  virtualCharacter?: string;
  inputMode?: string;
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
  doctorData?: {
    doctorLevel?: string;
    doctorComment?: string;
  };
  lastSessionID?: string | null;
  doctorLevel?: string;
  doctorComment?: string;
}

// ---------- Helpers ----------
const levelColor = (lvl?: string) => {
  switch ((lvl || "").toLowerCase()) {
    case "minimal":
      return "green";
    case "moderate":
      return "gold";
    case "severe":
      return "red";
    default:
      return "default";
  }
};

// Small placeholder avatars (keeps Workbench feel)
const projectUsers = [
  { avatar: avatar1, name: "John" },
  { avatar: avatar2, name: "Wiliam" },
  { avatar: avatar3, name: "Kevin" },
  { avatar: avatar4, name: "Maciej" },
  { avatar: avatar5, name: "Kamil" },
];

// Optional charts placeholders (you can repurpose as needed)
const monthlyRevenue = {
  series: [{ name: "Revenue", data: [30, 40, 35, 50, 49, 70, 91, 60, 50, 55, 60, 65] }],
  categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  percent: 5.44,
};

const totalIncome = {
  series: [44, 55, 41, 17],
  labels: ["Income", "Download", "Rent", "Views"],
  details: [
    { label: "Income", value: 23876 },
    { label: "Download", value: 23876 },
    { label: "Rent", value: 23876 },
    { label: "Views", value: 23876 },
  ],
};

// ---------- Component ----------
export default function DoctorWorkbench() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [comment, setComment] = useState("");
  const apiBase = import.meta.env.VITE_APP_API_BASE_URL1;

  // Chart options based on Workbench's useChart
  const chartOptions = useChart({
    xaxis: { categories: monthlyRevenue.categories },
    chart: { toolbar: { show: false } },
    grid: { show: false },
    stroke: { curve: "smooth" },
    dataLabels: { enabled: false },
    yaxis: { show: false },
    legend: { show: false },
  });

  const donutOptions = useChart({
    labels: totalIncome.labels,
    legend: { show: false },
    dataLabels: { enabled: false },
    plotOptions: { pie: { donut: { size: "70%" } } },
  });

  useEffect(() => {
    fetchAllUsers();
    fetchLevelDetection();
    fetchDoctorLevels();
  }, [apiBase]);

  // ---------- API calls ----------
  const fetchAllUsers = async () => {
    setLoading(true);
    const token = getItem(StorageEnum.UserToken);
    console.log("Fetched token:", token);
    try {
      const response = await axios.get<{ message: string; preferences: { users: User[] } }>(
        `${apiBase}/api/blissme/all-preferences`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log("Response from all-preferences:", response);
      const fetched = response.data.preferences.users || [];
      setUsers(fetched);
    } catch (error: any) {
      console.error("Error fetching characters:", error?.message || error);
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
            const last = await axios.get<{ success: boolean; sessionID: string | null; answeredCount: number }>(
              `${apiBase}/phq9/last-session/${ld.userID}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );

            const isComplete = last.data.answeredCount === 9;
            return {
              ...ld,
              level: isComplete ? ld.level : "Pending",
              lastSessionID: last.data.sessionID,
            } as User;
          } catch (err) {
            console.error("Error fetching PHQ9 session for user", ld.userID, err);
            return { ...ld, level: "Pending", lastSessionID: null } as User;
          }
        })
      );

      // Merge with users (prefer preserving existing user fields like nickname)
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

  const fetchDoctorLevels = async () => {
    const token = getItem(StorageEnum.UserToken);
    try {
      const res = await axios.get<{ success: boolean; data: { userID: number; level?: string; comment?: string }[] }>(
        `${apiBase}/doctorlevel/comments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const doctorData = res.data.data || [];

      setUsers((prevUsers) =>
        prevUsers.map((user) => {
          const match = doctorData.find((d) => d.userID === user.userID);
          return match
            ? {
                ...user,
                doctorLevel: match.level,
                doctorComment: match.comment,
              }
            : user;
        })
      );
    } catch (err: any) {
      console.error("Error fetching doctor levels:", err?.message || err);
    }
  };

  // ---------- Modal handlers ----------
  const openCommentModal = (user: User) => {
    setSelectedUser(user);
    setSelectedLevel(user.level || "");
    setComment(user.doctorComment || "");
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const handleSubmitComment = async () => {
    if (!selectedUser) return;
    const token = getItem(StorageEnum.UserToken);

    try {
      await axios.post(
        `${apiBase}/doctorlevel/comments`,
        {
          userID: selectedUser.userID,
          comment,
          level: selectedLevel,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      message.success("Comment saved successfully!");
      setIsModalOpen(false);

      setUsers((prev) =>
        prev.map((u) =>
          u.userID === selectedUser.userID ? { ...u, doctorLevel: selectedLevel, doctorComment: comment } : u
        )
      );
    } catch (error: any) {
      console.error("Error saving comment:", error?.message || error);
      message.error("Failed to save comment.");
    }
  };

  // ---------- Derived counts ----------
  const totalPatients = users.length;
  const severePatients = users.filter((u) => u.level?.toLowerCase() === "severe").length;
  const moderatePatients = users.filter((u) => u.level?.toLowerCase() === "moderate").length;
  const minimalPatients = users.filter((u) => u.level?.toLowerCase() === "minimal").length;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Banner / header (keeps Workbench card) */}
      <Card>
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <Title as="h2" className="text-xl font-bold">
              {GLOBAL_CONFIG.appName} — Doctor Dashboard
            </Title>
            <Text variant="body2" className="text-slate-500">
              Overview of assessments & doctor annotations
            </Text>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {projectUsers.map((u) => (
                <Avatar key={u.name} className="inline-block w-8 h-8 rounded-full">
                  <AvatarImage src={u.avatar} />
                </Avatar>
              ))}
            </div>
            <Button size="sm" variant="default" onClick={() => fetchAllUsers()}>
              <Icon icon="mdi:refresh" size={16} /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Top summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex flex-col justify-between h-full">
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2">
              <div className="rounded-lg p-2" style={{ background: rgbAlpha("#7c3aed", 0.12) }}>
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
              <div className="rounded-lg p-2" style={{ background: rgbAlpha("#ef4444", 0.12) }}>
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
              <div className="rounded-lg p-2" style={{ background: rgbAlpha("#f59e0b", 0.12) }}>
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
              <div className="rounded-lg p-2" style={{ background: rgbAlpha("#10b981", 0.12) }}>
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

      {/* Main grid: recent + table + totals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: recent assessments */}
        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <Text variant="body2" className="font-semibold mb-2">
              Recent Assessments
            </Text>
            <div className="flex flex-col gap-2 max-h-64 overflow-auto">
              {users.slice(0, 6).map((user, idx) => (
                <div key={idx} className="flex items-center justify-between border-b py-2">
                  <div>
                    <p className="font-medium">{user.nickname}</p>
                    <p className="text-xs text-slate-500">Assessed: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}</p>
                  </div>
                  <AntdTag color={levelColor(user.level)}>{user.level || "N/A"}</AntdTag>
                </div>
              ))}
              {users.length === 0 && <p className="text-sm text-slate-500">No recent assessments</p>}
            </div>
          </CardContent>
        </Card>

        {/* Middle: main table */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <Text variant="body2" className="font-semibold">
                Patients
              </Text>
              <div className="flex items-center gap-2">
                <AntdButton size="small" onClick={() => { fetchAllUsers(); fetchLevelDetection(); fetchDoctorLevels(); }}>
                  Refresh
                </AntdButton>
              </div>
            </div>

            <div className="w-full overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">#</th>
                    <th className="py-2">Nickname</th>
                    <th className="py-2">Composite Index (R)</th>
                    <th className="py-2">Level</th>
                    <th className="py-2">Actions</th>
                    <th className="py-2">Doctor Level</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <tr key={user.userID || index} className="border-b last:border-0">
                      <td className="py-2 align-top">{index + 1}</td>
                      <td className="py-2">
                        <div className="flex flex-col">
                          <p className="font-medium">{user.nickname}</p>
                          <p className="text-xs text-slate-500">{user.components?.classifier?.emotion || ""}</p>
                        </div>
                      </td>
                      <td className="py-2 align-top w-[250px]">
                        <div className="flex flex-col gap-2">
                          <div className="font-semibold text-sm">{user.R_value ? (Number(user.R_value).toFixed(2)) : "0.00"}</div>
                          <AntdProgress
                            percent={Math.round((Number(user.R_value || 0) * 100))}
                            status="active"
                            strokeColor={levelColor(user.level) === "gold" ? "#faad14" : levelColor(user.level) === "red" ? "#ff4d4f" : "#52c41a"}
                            trailColor="rgba(0,0,0,0.08)"
                            showInfo={false}
                          />
                        </div>
                      </td>
                      <td className="py-2">
                        <AntdTag color={levelColor(user.level)}>{user.level || "Pending"}</AntdTag>
                      </td>
                      <td className="py-2">
                        <AntdButton
                          type="primary"
                          icon={<PencilLine size={14} />}
                          disabled={!!user.doctorComment || user.level === "Pending"}
                          onClick={() => openCommentModal(user)}
                        >
                          Add Comment
                        </AntdButton>
                      </td>
                      <td className="py-2">
                        <AntdTag color={levelColor(user.doctorLevel)}>{user.doctorLevel || "N/A"}</AntdTag>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">No patients found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom summary / charts area (optional) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Text variant="body2" className="font-semibold">Monthly Revenue</Text>
              <span className="flex items-center gap-1 text-green-500 font-bold text-sm">
                <Icon icon="mdi:arrow-up" size={16} />
                {monthlyRevenue.percent}%
              </span>
            </div>
            <Chart type="area" height={220} options={chartOptions} series={monthlyRevenue.series} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col items-center">
            <Text variant="body2" className="font-semibold mb-2">Total Income</Text>
            <Chart type="donut" height={160} options={donutOptions} series={totalIncome.series} />
            <div className="w-full mt-4">
              {totalIncome.details.map((item, i) => (
                <div key={item.label} className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: ["#3b82f6", "#f59e42", "#10b981", "#6366f1"][i] }} />
                    <Text variant="body2">{item.label}</Text>
                  </div>
                  <span className="font-bold">${item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comment Modal (Ant Design) */}
      <Modal
        title={`Add Comment for ${selectedUser?.nickname || ""}`}
        open={isModalOpen}
        onCancel={handleCancel}
        onOk={handleSubmitComment}
        okText="Save Comment"
      >
        <div className="flex flex-col gap-3">
          <AntdSelect
            value={selectedLevel}
            onChange={(val) => setSelectedLevel(val)}
            placeholder="Select Depression Level"
          >
            <AntdSelect.Option value="Minimal">Minimal</AntdSelect.Option>
            <AntdSelect.Option value="Moderate">Moderate</AntdSelect.Option>
            <AntdSelect.Option value="Severe">Severe</AntdSelect.Option>
          </AntdSelect>

          <AntdInput.TextArea
            rows={4}
            placeholder="Enter your comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
