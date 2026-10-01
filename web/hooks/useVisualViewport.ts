"use client";

import {useSyncExternalStore} from "react";

// 화면 키보드가 올라오면 visual viewport가 줄어든다.
// 바텀시트를 그만큼 띄워서 저장 버튼이 항상 키보드 바로 위에 보이게 하는 데 쓴다.
// (iOS는 키보드가 떠도 레이아웃 뷰포트가 그대로라 fixed bottom 요소가 키보드 뒤로 숨는다)

const subscribe = (onChange: () => void) => {
    const viewport = window.visualViewport
    if (!viewport) return () => {}
    viewport.addEventListener("resize", onChange)
    viewport.addEventListener("scroll", onChange)
    return () => {
        viewport.removeEventListener("resize", onChange)
        viewport.removeEventListener("scroll", onChange)
    }
}

// 키보드 등으로 가려진 화면 아래쪽 높이(px)
const getKeyboardInset = () => {
    const viewport = window.visualViewport
    if (!viewport) return 0
    return Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
}

// 지금 실제로 보이는 높이(px)
const getVisibleHeight = () => Math.round(window.visualViewport?.height ?? window.innerHeight)

export function useKeyboardInset() {
    return useSyncExternalStore(subscribe, getKeyboardInset, () => 0)
}

export function useVisibleHeight() {
    return useSyncExternalStore(subscribe, getVisibleHeight, () => 0)
}
