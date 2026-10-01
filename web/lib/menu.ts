// 같은 메뉴인지 비교할 때 쓰는 키. 서버(apps/restaurant/menus.py)와 같은 기준이다.
// "간장 치킨"과 "간장치킨", "Pizza"와 "pizza"를 같게 본다.
export const normalizeMenu = (menu: string) => menu.replace(/\s+/g, "").toLowerCase()
