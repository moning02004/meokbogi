import {LuUser} from "react-icons/lu";
import {IoMdHome} from "react-icons/io";
import {FaGamepad, FaPlus} from "react-icons/fa";
import {BsForkKnife} from "react-icons/bs";
import type {IconType} from "react-icons";

interface MenuItemsType {
    name: string;
    icon: IconType;
    path: string;
    floating?: boolean;
}

export const menuItems: MenuItemsType[] = [
    {name: "홈", icon: IoMdHome, path: "/home"},
    {name: "뽑기", icon: FaGamepad, path: "/play"},
    {name: "식당등록", icon: FaPlus, path: "/restaurant/add", floating: true},
    {name: "식당", icon: BsForkKnife, path: "/restaurant"},
    {name: "내정보", icon: LuUser, path: "/my-info"},
];