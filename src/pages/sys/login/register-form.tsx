import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/ui/form";
import { Input } from "@/ui/input";

import { userSignUpService } from "@/api/services/userAuthService";
import { useForm } from "react-hook-form";
import { validateUsername, passwordFieldValidation } from "@/utils/helper";
import {
  LoginStateEnum,
  useLoginStateContext,
} from "./providers/login-provider";
import { Icon } from "@/components/icon";
import { useTranslation } from "react-i18next";

function RegisterForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { loginState, setLoginState } = useLoginStateContext();
  const { t } = useTranslation();

  const form = useForm({
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onChange",
  });
  if (loginState !== LoginStateEnum.REGISTER) return null;

  const onFinish = async (values: any) => {
    try {
      setLoading(true);
      const response = await userSignUpService(values);

      if (response.message === "Successfully Registered") {
        toast.success("Signup Successful");
        navigate("/mode/nick-name", { replace: true });
      } else {
        toast.error("Signup failed. Please try again later");
      }
    } catch (error: any) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFinish)} className="space-y-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">Sign Up</h1>
        </div>

        {/* Username */}
        <FormField
          control={form.control}
          name="username"
          rules={{
            required: "Username is required",
            validate: validateUsername,
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

        {/* Email */}
        <FormField
          control={form.control}
          name="email"
          rules={{
            required: "Email is required",
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: "Invalid email address",
            },
          }}
          render={({ field, fieldState }) => (
            <FormItem>
              <FormControl>
                <Input placeholder="Enter your email" {...field} />
              </FormControl>
              {fieldState.error && (
                <FormMessage>{fieldState.error.message}</FormMessage>
              )}
            </FormItem>
          )}
        />

        {/* Password */}
        <FormField
          control={form.control}
          name="password"
          rules={{
            required: "Password is required",
            validate: passwordFieldValidation,
          }}
          render={({ field, fieldState }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  {...field}
                />
              </FormControl>
              {fieldState.error && (
                <FormMessage>{fieldState.error.message}</FormMessage>
              )}
            </FormItem>
          )}
        />

        {/* Confirm Password */}
        <FormField
          control={form.control}
          name="confirmPassword"
          rules={{
            required: "Confirm password is required",
            validate: (value) =>
              value === form.getValues("password") || "Passwords do not match",
          }}
          render={({ field, fieldState }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Confirm your password"
                  {...field}
                />
              </FormControl>
              {fieldState.error && (
                <FormMessage>{fieldState.error.message}</FormMessage>
              )}
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Registering..." : "Register"}
        </Button>

        <div className="text-center text-sm">
          <Button
            variant="link"
            className="px-1"
            onClick={() => setLoginState(LoginStateEnum.LOGIN)}
          >
            <Icon icon="solar:alt-arrow-left-linear" size={20} />
            <span className="text-sm">{t("sys.login.backSignIn")}</span>
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default RegisterForm;
