import type {Metadata} from "next";
import {Geist, Geist_Mono} from "next/font/google";
import {Toaster} from "react-hot-toast";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "먹보기: 먹어보고 기록하고",
    description: "음식점을 기록하고 선택을 위한",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
        <body className="min-h-full flex flex-col">
        {children}

        <Toaster position="bottom-center" containerStyle={{
            bottom: 80
        }}/>
        </body>
        </html>
    );
}
