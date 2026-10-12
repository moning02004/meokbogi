import type {MetadataRoute} from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "먹보기: 먹어보고 기록하고",
        short_name: "먹보기",
        description: "음식점을 기록하고 선택을 위한",
        start_url: "/",
        display: "standalone",
        background_color: "#F3F4F7",
        theme_color: "#F3F4F7",
        icons: [
            {
                src: "/icons/icon-192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/icons/icon-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/icons/icon-maskable-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
        ],
    };
}
