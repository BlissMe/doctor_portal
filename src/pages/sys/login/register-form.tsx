import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/ui/form";
import { Input } from "@/ui/input";

import { ReturnButton } from "./components/ReturnButton";
import { userSignUpService } from "@/api/services/userAuthService";
import { useForm } from "react-hook-form";

function RegisterForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const form = useForm({
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const backToLogin = () => {
    navigate("/login", { replace: true });
  };

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

        <FormField
          control={form.control}
          name="username"
          rules={{ required: "Username is required" }}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder="Enter your username" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder="Enter your email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          rules={{ required: "Password is required" }}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input type="password" placeholder="Enter your password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          rules={{
            required: "Confirm password is required",
            validate: (value) => value === form.getValues("password") || "Passwords do not match",
          }}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input type="password" placeholder="Confirm your password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          Register
        </Button>

        <div className="mb-2 text-xs text-gray-500">
          <span>By registering, you agree to our </span>
          <a href="./" className="text-sm underline text-primary">
            Terms of Service
          </a>
          {" & "}
          <a href="./" className="text-sm underline text-primary">
            Privacy Policy
          </a>
        </div>

        <ReturnButton onClick={backToLogin} />
      </form>
    </Form>
  );
}

export default RegisterForm;
