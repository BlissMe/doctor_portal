import type { NavItemDataProps } from "@/components/nav/types";
import { GLOBAL_CONFIG } from "@/global-config";
import { checkAny } from "@/utils";
import { backendNavData } from "./nav-data-backend";
import { frontendNavData } from "./nav-data-frontend";

const navData = GLOBAL_CONFIG.routerMode === "backend" ? backendNavData : frontendNavData;

/**
 * 递归处理导航数据，过滤掉没有权限的项目
 * @param items 导航项目数组
 * @param permissions 权限列表
 * @returns 过滤后的导航项目数组
 */
const filterItems = (items: NavItemDataProps[], permissions?: string[]) => {
  return items.filter((item) => {
    const hasPermission = item.auth ? checkAny(item.auth, permissions ?? []) : true;

    if (item.children?.length) {
      const filteredChildren = filterItems(item.children, permissions);
      if (filteredChildren.length === 0) return false;
      item.children = filteredChildren;
    }

    return hasPermission;
  });
};

const filterNavData = () => {
  return navData
    .map((group) => {
      const filteredItems = filterItems(group.items);

      if (filteredItems.length === 0) return null;

      return { ...group, items: filteredItems };
    })
    .filter((group): group is NonNullable<typeof group> => group !== null);
};

export const useFilteredNavData = () => {
  return filterNavData();
};
