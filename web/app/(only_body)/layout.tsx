"use client";

import {Providers} from "@/app/(main)/providers";
import {LoadingPage} from "@/components/loading";
import {useAuthBootstrap} from "@/hooks/useAuthBootstrap";
import {useZoneBootstrap} from "@/hooks/useZoneBootstrap";

export default function MainLayout({children}: {
    children: React.ReactNode;
}) {
    const {isReady} = useAuthBootstrap()
    useZoneBootstrap(isReady)

    if (!isReady) return <LoadingPage/>

    return (
        <div className="flex flex-col h-dvh w-full max-w-[560px] mx-auto bg-bg">
            <div className="flex-1 min-h-0 overflow-y-auto">
                <Providers>
                    {children}
                </Providers>
            </div>
        </div>
    );
}
