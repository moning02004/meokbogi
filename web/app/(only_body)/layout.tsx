"use client";

import {Providers} from "@/app/(main)/providers";
import {LoadingPage} from "@/components/loading";
import {useAuthBootstrap} from "@/hooks/useAuthBootstrap";

export default function MainLayout({children}: {
    children: React.ReactNode;
}) {
    const {isReady} = useAuthBootstrap()

    if (!isReady) return <LoadingPage/>

    return (
        <div className="flex flex-col h-screen w-full sm:w-[70%] mx-auto">
            <div className="flex-1  flex-wrap overflow-y-auto">
                <Providers>
                    {children}
                </Providers>
            </div>
        </div>
    );
}
