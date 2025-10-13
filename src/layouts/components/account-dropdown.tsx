import { useLoginStateContext } from "@/pages/sys/login/providers/login-provider";
import { useRouter } from "@/routes/hooks";
import { useUserActions, useUserInfo } from "@/store/userStore";
import { Button } from "@/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { useTranslation } from "react-i18next";
import StaticAvatar from "@/assets/images/background/image.png";

export default function AccountDropdown() {
  const { replace } = useRouter();
  const { clearUserInfoAndToken } = useUserActions();
  const { backToLogin } = useLoginStateContext();
  const { t } = useTranslation();

  const userInfo = useUserInfo();

  const username = userInfo?.username || "User";
  const email = userInfo?.email || "-";

  const logout = () => {
    try {
      clearUserInfoAndToken();
      backToLogin();
    } catch (error) {
      console.log(error);
    } finally {
      replace("/auth/login");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <img
            className="h-6 w-6 rounded-full"
            src={StaticAvatar}
            alt="avatar"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56">
        <div className="flex items-center gap-2 p-2">
          <img
            className="h-10 w-10 rounded-full"
            src={StaticAvatar}
            alt="avatar"
          />
          <div className="flex flex-col items-start">
            <div className="text-text-primary text-sm font-medium">
              {username}
            </div>
            <div className="text-text-secondary text-xs">{email}</div>
          </div>
        </div>

        <DropdownMenuSeparator />

       {/*  <DropdownMenuItem asChild>
          <NavLink to="/management/user/profile">
            {t("sys.nav.user.profile")}
          </NavLink>
        </DropdownMenuItem> */}

       {/*  <DropdownMenuItem asChild>
          <NavLink to="/management/user/account">
            {t("sys.nav.user.account")}
          </NavLink>
        </DropdownMenuItem> */}

        <DropdownMenuSeparator />

        <DropdownMenuItem className="font-bold text-warning" onClick={logout}>
          {t("sys.login.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
