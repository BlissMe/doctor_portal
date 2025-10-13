export const validateUsername = (value: string) => {
  const usernameRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)[A-Za-z\d@]{6,10}$/;
  if (!value) return "Username is required!";
  if (!usernameRegex.test(value))
    return "Username must be 6–10 chars, include a capital letter, and can contain letters, numbers, or @.";
  return true; // valid
};

export const passwordFieldValidation = (value: string) => {
  if (!value) return "Password is required!";
  if (value.length < 6) return "Password must be at least 6 characters";
  if (!/(?=.*[A-Z])/.test(value)) return "Password must have at least one capital letter";
  if (!/(?=.*\d)/.test(value)) return "Password must have at least one number";
  return true;
};
