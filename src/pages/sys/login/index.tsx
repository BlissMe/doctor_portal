import PlaceholderImg from "@/assets/images/background/placeholder.svg";
import Logo from "@/components/logo";
import SettingButton from "@/layouts/components/setting-button";
import {
  LoginProvider,
  useLoginStateContext,
  LoginStateEnum,
} from "./providers/login-provider";
import LoginForm from "./login-form";
import RegisterForm from "./register-form";
import ResetForm from "./reset-form";

function LoginPage() {
  const { loginState } = useLoginStateContext();

  return (
    <div className="relative grid min-h-svh lg:grid-cols-2 bg-background">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        {/* Header / Logo */}
        <div className="flex justify-center gap-2 md:justify-start">
          <div className="flex items-center gap-2 font-medium cursor-pointer">
            <Logo size={28} />
            <span>Doctor Portal</span>
          </div>
        </div>

        {/* Forms */}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginProvider>
              {/* Only render the active form */}
              {loginState === LoginStateEnum.LOGIN && <LoginForm />}
              {loginState === LoginStateEnum.REGISTER && <RegisterForm />}
              {loginState === LoginStateEnum.RESET_PASSWORD && <ResetForm />}
            </LoginProvider>
          </div>
        </div>
      </div>

      {/* Background Image */}
      <div className="relative hidden bg-background-paper lg:block">
        <img
          src={PlaceholderImg}
          alt="placeholder img"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.5] dark:grayscale"
        />
      </div>

      {/* Top-right controls */}
      <div className="absolute right-2 top-0 flex flex-row">
        <SettingButton />
      </div>
    </div>
  );
}

export default LoginPage;
