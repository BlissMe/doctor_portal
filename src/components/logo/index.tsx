import { Icon } from "../icon";

interface Props {
  size?: number | string;
  className?: string;
}
function Logo({ size = 50 }: Props) {
  return (
    <Icon
      icon="local:ic-logo-badge"
      size={size}
      color="var(--colors-palette-primary-default)"
    />
  );
}

export default Logo;
