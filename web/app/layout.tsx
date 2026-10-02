import type {Metadata, Viewport} from "next";
import {Geist_Mono} from "next/font/google";
import {Toaster} from "react-hot-toast";
// 본문 글꼴. 맥의 기본 한글 글꼴(애플 SD 산돌고딕 Neo)과 닮은 부드러운 고딕을 어느 기기에서나 같게 보여준다.
// 글자 범위별로 잘린 파일이라 화면에 쓰인 글자가 든 조각만 받는다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import {ServiceWorkerRegistrar} from "@/components/service_worker";

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "먹보기: 먹어보고 기록하고",
    description: "음식점을 기록하고 선택을 위한",
    icons: {
        apple: "/icons/apple-touch-icon.png",
    },
    appleWebApp: {
        title: "먹보기",
        // 홈 화면 앱의 상태바. black-translucent 는 페이지를 상태바 밑까지 올리고 시계를 흰 글자로 그려서,
        // 흰 상단바와 겹치고 글자도 묻혔다. default 는 흰 바탕·검은 글자 상태바 아래에서 페이지를 시작한다.
        statusBarStyle: "default",
    },
};

export const viewport: Viewport = {
    themeColor: "#24564A",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="ko"
            className={`${geistMono.variable} h-full antialiased`}
        >
        <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegistrar/>

        <Toaster position="bottom-center" containerStyle={{
            bottom: 80
        }}/>
        </body>
        </html>
    );
}
