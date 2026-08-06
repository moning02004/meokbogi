"use client";

import {Providers} from "@/app/(main)/providers";
import {Topbar} from "@/components/ui/top_bar";
import {Bottombar} from "@/components/ui/bottom_bar";
import {LoadingPage} from "@/components/loading";
import {useAuthBootstrap} from "@/hooks/useAuthBootstrap";
import {useZoneStore} from "@/store/zone";

export default function MainLayout({children}: {
    children: React.ReactNode;
}) {
    const {isReady} = useAuthBootstrap()
    const zones = useZoneStore(state => state.zones)

    if (!isReady) return <LoadingPage/>

    return (
        <div className="flex flex-col h-screen w-full sm:w-[70%] mx-auto">
            {zones.length !== 0 && <Topbar/>}

            <div className="flex-1 flex-wrap overflow-y-auto h-[85vh]">
                <Providers>
                    {children}
                </Providers>
            </div>
            {zones.length !== 0 &&
                <div className="border-t border-[#dedede] bg-white">
                    <div className="w-full mx-auto">
                        <Bottombar/>
                    </div>
                </div>
            }

        </div>
    );
}
