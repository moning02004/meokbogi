"use client";

import {Providers} from "@/app/(main)/providers";
import {LoadingPage} from "@/components/loading";
import {useAuthBootstrap} from "@/hooks/useAuthBootstrap";
import {Topbar} from "@/components/ui/top_bar";
import {Bottombar} from "@/components/ui/bottom_bar";

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

            <div className="border-t border-[#dedede] bg-white">
                <div className="w-full mx-auto">
                    <Bottombar/>
                </div>
            </div>
        </div>
    );
}
