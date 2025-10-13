import Icon from "@/components/icon/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Text, Title } from "@/ui/typography";
import { rgbAlpha } from "@/utils/theme";
import { useEffect, useState } from "react";
import BannerCard from "./banner-card";
import { getItem } from "@/utils/storage";
import { StorageEnum } from "@/types/enum";
import axios from "axios";
import { Activity, HeartPulse, TrendingUp, User, Users } from "lucide-react";
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

export default function Workbench() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [comment, setComment] = useState("");
  const apiBase = import.meta.env.VITE_APP_API_BASE_URL;
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
                    <td className="table-cell">
                      <div className="flex flex-col">
                        <p className="font-medium text-slate-900 dark:text-slate-50">
                          {user.nickname}
                        </p>
                      </div>
                    </td>
                    <td className="table-cell text-white">
                      <div className="flex flex-col text-white">
                        <Typography.Text strong className="text-white">
                          Composite Index (R)
                        </Typography.Text>
                        <Progress
                          percent={Math.round(Number(user.R_value || 0) * 100)}
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
                        <Tag color={levelColor(user.level)}>{user.level}</Tag>
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
