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
import { useEffect, useState } from "react";
import BannerCard from "./banner-card";
import { getItem } from "@/utils/storage";
import { StorageEnum } from "@/types/enum";
import axios from "axios";
import {
  Activity,
  HeartPulse,
  PencilLine,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import {
  message,
  Typography,
  Progress,
  Tag,
  Modal,
  Input as AntdInput,
  Select as AntdSelect,
} from "antd";

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
const quickStats = [
  {
    icon: "solar:wallet-outline",
    label: "All Earnings",
    value: "$3,020",
    percent: 30.6,
    color: "#3b82f6",
    chart: [12, 18, 14, 16, 12, 10, 14, 18, 16, 14, 12, 10],
  },
  {
    icon: "solar:graph-outline",
    label: "Page Views",
    value: "290K+",
    percent: 30.6,
    color: "#f59e42",
    chart: [8, 12, 10, 14, 18, 16, 14, 12, 10, 14, 18, 16],
  },
  {
    icon: "solar:checklist-outline",
    label: "Total Task",
    value: "839",
    percent: 0,
    color: "#10b981",
    chart: [10, 14, 12, 16, 18, 14, 12, 10, 14, 18, 16, 12],
  },
  {
    icon: "solar:download-outline",
    label: "Download",
    value: "2,067",
    percent: -30.6,
    color: "#ef4444",
    chart: [16, 14, 12, 10, 14, 18, 16, 12, 10, 14, 18, 16],
  },
];

const monthlyRevenue = {
  series: [
    {
      name: "Revenue",
      data: [30, 40, 35, 50, 49, 70, 91, 60, 50, 55, 60, 65],
    },
  ],
  categories: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  percent: 5.44,
};

const projectTasks = [
  { label: "Horizontal Layout", color: "#3b82f6" },
  { label: "Invoice Generator", color: "#f59e42" },
  { label: "Package Upgrades", color: "#fbbf24" },
  { label: "Figma Auto Layout", color: "#10b981" },
];

const projectUsers = [
  { avatar: avatar1, name: "John" },
  { avatar: avatar2, name: "Wiliam" },
  { avatar: avatar3, name: "Kevin" },
  { avatar: avatar4, name: "Maciej" },
  { avatar: avatar5, name: "Kamil" },
];
const transactions = [
  {
    icon: "mdi:spotify",
    name: "Spotify Music",
    id: "#T11032",
    amount: 10000,
    time: "06:30 pm",
    status: "up",
  },
  {
    icon: "mdi:medium",
    name: "Medium",
    id: "#T11032",
    amount: -26,
    time: "08:30 pm",
    status: "down",
  },
  {
    icon: "mdi:uber",
    name: "Uber",
    id: "#T11032",
    amount: 210000,
    time: "08:40 pm",
    status: "up",
  },
  {
    icon: "mdi:taxi",
    name: "Ola Cabs",
    id: "#T11032",
    amount: 210000,
    time: "07:40 pm",
    status: "up",
  },
];

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

export default function Workbench() {
  const [activeTab, setActiveTab] = useState("All Transaction");
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
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [comment, setComment] = useState("");
  const apiBase = import.meta.env.VITE_APP_API_BASE_URL1;
  useEffect(() => {
    fetchAllUsers();
    fetchLevelDetection();
    fetchDoctorLevels();
  }, [apiBase]);
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
            const last = await axios.get<{
              success: boolean;
              sessionID: string | null;
              answeredCount: number;
            }>(`${apiBase}/phq9/last-session/${ld.userID}`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            const isComplete = last.data.answeredCount === 9;
            return {
              ...ld,
              level: isComplete ? ld.level : "Pending",
              lastSessionID: last.data.sessionID,
            } as User;
          } catch (err) {
            console.error(
              "Error fetching PHQ9 session for user",
              ld.userID,
              err
            );
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
      const res = await axios.get<{
        success: boolean;
        data: { userID: number; level?: string; comment?: string }[];
      }>(`${apiBase}/doctorlevel/comments`, {
        headers: { Authorization: `Bearer ${token}` },
      });

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
          u.userID === selectedUser.userID
            ? { ...u, doctorLevel: selectedLevel, doctorComment: comment }
            : u
        )
      );
    } catch (error: any) {
      console.error("Error saving comment:", error?.message || error);
      message.error("Failed to save comment.");
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

  return (
    <div className="flex flex-col gap-4 w-full">
      <BannerCard />
      {/* 顶部四个统计卡片 */}
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

      {/* 月度收入+项目进度区块 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Text variant="body2" className="font-semibold">
                Monthly Revenue
              </Text>
              <span className="flex items-center gap-1 text-green-500 font-bold text-sm">
                <Icon icon="mdi:arrow-up" size={16} />
                {monthlyRevenue.percent}%
              </span>
            </div>
            <Chart
              type="area"
              height={220}
              options={chartOptions}
              series={monthlyRevenue.series}
            />
          </CardContent>
        </Card>
        <Card className="flex flex-col gap-4 p-6">
          <Text variant="body2" className="font-semibold  mb-2">
            Project - {GLOBAL_CONFIG.appName}
          </Text>
          <div className="flex items-center justify-between mb-2">
            <Text variant="body2">Release v1.2.0</Text>
            <span className="text-xs font-bold text-blue-500">70%</span>
          </div>
          {/* 					<Progress value={70} />
           */}{" "}
          <ul className="flex flex-col gap-2 mt-2 mb-4">
            {projectTasks.map((task) => (
              <li key={task.label} className="flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: task.color }}
                />
                <Text variant="body2">{task.label}</Text>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* 项目概览区块 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 flex flex-col gap-4 p-6">
          <Text variant="body2" className="font-semibold mb-2">
            Project overview
          </Text>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <Text variant="body2">Total Tasks</Text>
              <Title as="h3" className="text-xl font-bold">
                34,686
              </Title>
            </div>
            <div>
              <Text variant="body2">Pending Tasks</Text>
              <Title as="h3" className="text-xl font-bold">
                3,786
              </Title>
            </div>
            <div className="flex-1 flex items-center justify-end">
              <Button className="w-48" size="sm" variant="default">
                <Icon icon="mdi:plus" size={18} /> Add project
              </Button>
            </div>
          </div>
          <div className="w-full h-16 mt-4">
            <Chart
              type="line"
              height={60}
              options={useChart({
                chart: { sparkline: { enabled: true } },
                colors: ["#ef4444"],
                grid: { show: false },
                yaxis: { show: false },
                tooltip: { enabled: false },
              })}
              series={[{ data: [10, 20, 15, 30, 25, 40, 35, 20] }]}
            />
          </div>
        </Card>
        <Card className="flex flex-col gap-4 p-6 items-center justify-center">
          <Text variant="body2" className="font-semibold mb-2">
            {GLOBAL_CONFIG.appName}
          </Text>
          <div className="flex -space-x-2 mb-2">
            {projectUsers.map((user) => (
              <Avatar
                key={user.name}
                className="inline-block w-8 h-8 rounded-full"
              >
                <AvatarImage src={user.avatar} />
              </Avatar>
            ))}
          </div>
          <Button
            className="w-10 h-10 rounded-full flex items-center justify-center"
            size="icon"
            variant="secondary"
          >
            <Icon icon="mdi:plus" size={20} />
          </Button>
        </Card>
      </div>

      {/* 交易+收入区块 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 flex flex-col p-6">
          <div className="flex-1 overflow-x-auto">
            <div className="card-body p-0">
              <div className="relative h-[500px] w-full flex-shrink-0 overflow-auto rounded-none [scrollbar-width:_thin]">
                <table className="table">
                  <thead className="table-header">
                    <tr className="table-row">
                      <th className="table-head">#</th>
                      {/*                   <th className="table-head">UserID</th>
                       */}{" "}
                      <th className="table-head">Nickname</th>
                      {/*<th className="table-head">Emotion</th>*/}
                      <th className="table-head">Actions</th>
                      <th className="table-head">Actions</th>
                      <th className="table-head">Comment</th>
                      <th className="table-head">Doctor Level</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {users.map((user, index) => (
                      <tr key={index} className="table-row">
                        <td className="table-cell">{index + 1}</td>
                        {/*                     <td className="table-cell">{user.userID}</td>
                         */}{" "}
                        <td className="table-cell">
                          <div className="flex flex-col">
                            <p className="font-medium text-slate-900 dark:text-slate-50">
                              {user.nickname}
                            </p>
                          </div>
                        </td>
                        {/*   <td className="table-cell">
                      <div className="flex flex-col">
                        <p className="font-medium text-slate-900 dark:text-slate-50">
                          {user.components?.classifier?.emotion}
                        </p>
                      </div>
                    </td> */}
                        <td className="table-cell text-white">
                          <div className="flex flex-col text-white">
                            <Typography.Text strong className="text-white">
                              Composite Index (R)
                            </Typography.Text>
                            <Progress
                              percent={Math.round(
                                Number(user.R_value || 0) * 100
                              )}
                              status="active"
                              strokeColor={
                                levelColor(user.level) === "gold"
                                  ? "#faad14"
                                  : levelColor(user.level) === "red"
                                  ? "#ff4d4f"
                                  : "#52c41a"
                              }
                              trailColor="rgba(255, 255, 255, 0.2)"
                              showInfo
                            />
                          </div>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-x-4">
                            <Tag color={levelColor(user.level)}>
                              {user.level}
                            </Tag>
                          </div>
                        </td>
                        <td className="table-cell">
                          <Button
                            className="w-48"
                            size="sm"
                            variant="default"
                            disabled={
                              !!user.doctorComment || user.level === "Pending"
                            }
                            onClick={() => openCommentModal(user)}
                          >
                            <Icon icon="mdi:plus" size={18} /> Add Comment
                          </Button>
                        </td>
                        <td className="table-cell">
                          <Tag color={levelColor(user.doctorLevel)}>
                            {user.doctorLevel || "N/A"}
                          </Tag>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Card>
        <Card className="flex flex-col p-6">
          <Text variant="body2" className="font-semibold  mb-2">
            Total Income
          </Text>
          <div className="flex-1 flex flex-col items-center justify-center">
            <Chart
              type="donut"
              height={180}
              options={donutOptions}
              series={totalIncome.series}
            />
            <div className="w-full mt-4">
              {totalIncome.details.map((item, i) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between mb-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={"inline-block w-3 h-3 rounded-full"}
                      style={{
                        background: [
                          "#3b82f6",
                          "#f59e42",
                          "#10b981",
                          "#6366f1",
                        ][i],
                      }}
                    />
                    <Text variant="body2">{item.label}</Text>
                  </div>
                  <span className="font-bold">
                    ${item.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
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
