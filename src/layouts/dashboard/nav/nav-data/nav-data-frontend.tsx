import { Icon } from "@/components/icon";
import type { NavProps } from "@/components/nav";

export const frontendNavData: NavProps["data"] = [
	{
		name: "sys.nav.dashboard",
		items: [
			{
				title: "Doctor Dashboard",
				path: "/workbench",
				icon: <Icon icon="local:ic-workbench" size="24" />,
			},
			{
				title: "Dashobard",
				path: "/dashboard",
				icon: <Icon icon="local:ic-workbench" size="24" />,
			},
			{
				title: "System Dashboard",
				path: "/therapy",
				icon: <Icon icon="local:ic-analysis" size="24" />,
			},
		],
	},
	
];
