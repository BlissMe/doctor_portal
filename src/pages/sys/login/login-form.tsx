import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/ui/form";
import { Input } from "@/ui/input";
import { cn } from "@/utils";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  LoginStateEnum,
  useLoginStateContext,
} from "./providers/login-provider";
import { userSignInService } from "@/api/services/userAuthService";
import { useForm } from "react-hook-form";
import { GLOBAL_CONFIG } from "@/global-config";
import { useNavigate } from "react-router";
import useUserStore from "@/store/userStore";
import { StorageEnum } from "@/types/enum";
import { setItem } from "@/utils/storage";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const { loginState, setLoginState } = useLoginStateContext();
  const navigate = useNavigate();
  const { actions } = useUserStore();

  const form = useForm({
    defaultValues: {
      username: "",
      password: "",
    },
  });

  if (loginState !== LoginStateEnum.LOGIN) return null;

  const handleFinish = async (values: any) => {
    console.log("Login attempt with values:", values);
    setLoading(true);

    try {
      const response = await userSignInService(values);
      console.log("Response from API:", response);

      if (response.message === "Login successful" && response.data) {
        console.log("Login successful, proceeding...");
        setItem(StorageEnum.UserToken, response.data.token);
        console.log(response.data.token);
        toast.success("Login Successful");

        // Navigate first to avoid unmount issues
        console.log("Navigating to:", GLOBAL_CONFIG.defaultRoute);
        navigate(GLOBAL_CONFIG.defaultRoute, { replace: true });

        // Then safely update Zustand store
        console.log("Saving token and user info to store...");
        actions.setUserToken({ token: response.data.token });
        actions.setUserInfo({
          username: response.data.username,
          doctorID: response.data.doctorID,
          role: response.data.role,
          email: "",
        });
      } else {
        console.log("Login failed with message:", response.message);
        toast.error(response.message || "Login failed");
      }
    } catch (error: any) {
      console.log("Error during login:", error);
      toast.error(error.message || "Something went wrong");
    } finally {
      setLoading(false);
      console.log("Loading set to false");
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <Form {...form} {...props}>
        <form onSubmit={form.handleSubmit(handleFinish)} className="space-y-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-bold">Sign In</h1>
            <p className="text-balance text-sm text-muted-foreground">
              Please enter your account details to login
            </p>
          </div>

          <FormField
            control={form.control}
            name="username"
            rules={{
              required: "Username is required",
            }}
            render={({ field, fieldState }) => (
              <FormItem>
                <FormControl>
                  <Input placeholder="Enter your username" {...field} />
                </FormControl>
                {fieldState.error && (
                  <FormMessage>{fieldState.error.message}</FormMessage>
                )}
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            rules={{ required: "Password is required" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-row justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={remember}
                onCheckedChange={(checked) =>
                  setRemember(checked === "indeterminate" ? false : checked)
                }
              />
              <label
                htmlFor="remember"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Remember me
              </label>
            </div>
            <Button
              variant="link"
              onClick={() => setLoginState(LoginStateEnum.RESET_PASSWORD)}
              size="sm"
            >
              Forgot Password?
            </Button>
          </div>

          <Button type="submit" className="w-full">
            {loading && <Loader2 className="animate-spin mr-2" />}
            Login
          </Button>

          <div className="text-center text-sm">
            Don’t have an account?
            <Button
              variant="link"
              className="px-1"
              onClick={() => setLoginState(LoginStateEnum.REGISTER)}
            >
              Sign Up
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default LoginForm;
