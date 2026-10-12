"use client";

import {Providers} from "@/app/(main)/providers";
import {Topbar} from "@/components/ui/top_bar";
import {Bottombar} from "@/components/ui/bottom_bar";
import {LoadingPage} from "@/components/loading";
import {useAuthBootstrap} from "@/hooks/useAuthBootstrap";
import {useZoneBootstrap} from "@/hooks/useZoneBootstrap";
import {useZoneStore} from "@/store/zone";

export default function MainLayout({children}: {
    children: React.ReactNode;
}) {
    const {isReady} = useAuthBootstrap()
    useZoneBootstrap(isReady)
    const zones = useZoneStore(state => state.zones)

    if (!isReady) return <LoadingPage/>

    return (
        <div className="flex flex-col h-dvh w-full max-w-[560px] mx-auto bg-bg">
            {zones.length !== 0 && <Topbar/>}

            <div className="flex-1 min-h-0 overflow-y-auto">
                <Providers>
                    {children}
                </Providers>
            </div>
            {zones.length !== 0 &&
                <Bottombar/>
            }

        </div>
    );
}
