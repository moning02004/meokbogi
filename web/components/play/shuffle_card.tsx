'use client';

import {useEffect, useRef, useState} from 'react';
import {ACCENT_COLORS, CARD_H, CARD_W, shuffle, wait} from '@/constants/play';
import {ForkKnifeIcon} from "@/components/play/ForkKnifeIcon";

export interface FoodCardShuffleProps {
    categoryInfo: Record<string, number>;
    items: string[];
    trayColor?: string;
    setSelectedCategory: (value: number | null) => void;
}

type Pos = { x: number; y: number };

export default function FoodCardShuffle({
                                            categoryInfo,
                                            items,
                                            trayColor = '#17372F',
                                            setSelectedCategory,
                                        }: FoodCardShuffleProps) {
    const n = items.length;
    const cols = Math.min(4, n);
    const rows = Math.ceil(n / cols);

    const deckRef = useRef<HTMLDivElement>(null);
    const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
    const frontRefs = useRef<(HTMLDivElement | null)[]>([]);
    const backRefs = useRef<(HTMLDivElement | null)[]>([]);
    const rankTopRefs = useRef<(HTMLSpanElement | null)[]>([]);
    const rankBottomRefs = useRef<(HTMLSpanElement | null)[]>([]);

    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState('');
    const [hasPlayed, setHasPlayed] = useState(false);
    const boxH = rows * CARD_H + (rows - 1) * 16 + 40;

    function getBoxW() {
        return deckRef.current?.clientWidth || 480;
    }

    function gridPositions(): Pos[] {
        const boxW = getBoxW();
        const gapX = 14;
        const gapY = 16;
        const gridH = rows * CARD_H + (rows - 1) * gapY;
        const startY = (boxH - gridH) / 2;
        const pos: Pos[] = [];
        for (let i = 0; i < n; i++) {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const itemsInRow = Math.min(cols, n - row * cols);
            const rowW = itemsInRow * CARD_W + (itemsInRow - 1) * gapX;
            const rowStartX = (boxW - rowW) / 2;
            pos.push({x: rowStartX + col * (CARD_W + gapX), y: startY + row * (CARD_H + gapY)});
        }
        return pos;
    }

    function getCenter(): Pos {
        const boxW = getBoxW();
        return {x: boxW / 2 - CARD_W / 2, y: boxH / 2 - CARD_H / 2};
    }

    function place(idx: number, x: number, y: number, r: number, scale: number, z: number) {
        const el = cardRefs.current[idx];
        if (!el) return;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.zIndex = `${z}`;
        el.style.transform = `rotate(${r}deg) scale(${scale})`;
    }

    function flip(idx: number, faceUp: boolean) {
        const front = frontRefs.current[idx];
        const back = backRefs.current[idx];
        if (front) {
            front.style.opacity = faceUp ? '1' : '0';
            front.style.transform = `scaleX(${faceUp ? 1 : 0})`;
        }
        if (back) {
            back.style.opacity = faceUp ? '0' : '1';
            back.style.transform = `scaleX(${faceUp ? 0 : 1})`;
        }
    }

    function setRank(idx: number, rank: number) {
        if (rankTopRefs.current[idx]) rankTopRefs.current[idx]!.textContent = `${rank}`;
        if (rankBottomRefs.current[idx]) rankBottomRefs.current[idx]!.textContent = `${rank}`;
    }

    function resetBorder(idx: number) {
        const front = frontRefs.current[idx];
        if (front) {
            front.style.borderColor = '#E4DCC8';
            front.style.borderWidth = '1px';
            front.style.background = '#FAF6EC';
        }
    }

    useEffect(() => {
        const pos = gridPositions();
        pos.forEach((p, i) => place(i, p.x, p.y, 0, 1, 1));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boxH, n]);

    useEffect(() => {
        function onResize() {
            if (busy) return;
            const pos = gridPositions();
            pos.forEach((p, i) => place(i, p.x, p.y, 0, 1, 1));
        }

        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [busy, boxH]);

    async function shuffleSequence() {
        const pos = gridPositions();
        pos.forEach((p, i) => place(i, p.x, p.y, 0, 1, 1));
        await wait(150);

        for (let i = 0; i < n; i++) flip(i, false);
        await wait(300);

        const center = getCenter();
        for (let round = 0; round < 6; round++) {
            for (let i = 0; i < n; i++) {
                const jx = center.x + (Math.random() - 0.5) * 220;
                const jy = center.y + (Math.random() - 0.5) * (boxH * 0.5);
                const jr = (Math.random() - 0.5) * 70;
                place(i, jx, jy, jr, 1, i);
            }
            await wait(220);
        }

        for (let i = 0; i < n; i++) {
            const stackR = (Math.random() - 0.5) * 8;
            place(i, center.x + (Math.random() - 0.5) * 4, center.y + (Math.random() - 0.5) * 4, stackR, 1, i);
        }
        await wait(500);

        const order = shuffle(items).map((name) => items.indexOf(name));
        const finalPos = gridPositions();
        order.forEach((originalIdx, slot) => {
            const p = finalPos[slot];
            place(originalIdx, p.x, p.y, 0, 1, slot);
            setRank(originalIdx, slot + 1);
        });
        await wait(500);

        for (let i = 0; i < n; i++) flip(i, true);
        await wait(350);

        // 당첨 카드 강조 (앰버로 채우기)
        const winnerIdx = order[0];
        const front = frontRefs.current[winnerIdx];
        if (front) {
            front.style.borderColor = '#D2571E';
            front.style.borderWidth = '3px';
        }
        const p0 = finalPos[0];
        place(winnerIdx, p0.x, p0.y, 0, 1.5, 10);

        setResult(items[winnerIdx]);
        setSelectedCategory(categoryInfo[items[winnerIdx]])
        setBusy(false);
    }

    function handleShuffle() {
        if (busy) return;
        setSelectedCategory(null)

        setBusy(true);
        setResult('');
        setHasPlayed(true);
        for (let i = 0; i < n; i++) resetBorder(i);
        shuffleSequence();
    }

    return (
        <div className="flex flex-col items-center gap-1">
            <div className="w-full p-5 relative overflow-hidden" style={{background: trayColor}}>
                <div className="text-center text-[19px] font-bold tracking-tight text-white relative">
                    오늘의 <span className="text-[#F0A87E]">메뉴</span>, 골라드릴게요
                </div>
                <div ref={deckRef} className="relative w-full" style={{height: boxH}}>
                    {items.map((item, i) => {
                        const accent = ACCENT_COLORS[i % ACCENT_COLORS.length];
                        const start = {x: 0, y: 0};
                        return (
                            <div
                                key={item + i}
                                ref={(el) => {
                                    cardRefs.current[i] = el;
                                }}
                                className="absolute h-24 w-16 rounded-lg transition-[left,top,transform] duration-500 ease-out"
                                style={{left: start.x, top: start.y}}
                            >
                                {/* 앞면 */}
                                <div
                                    ref={(el) => {
                                        frontRefs.current[i] = el;
                                    }}
                                    className="absolute inset-0 flex flex-col items-center justify-between rounded-lg border border-[#E4DCC8] bg-[#FAF6EC] p-1.5 shadow transition-[opacity,transform,background,border-color] duration-300"
                                >
                                    <span
                                        ref={(el) => {
                                            rankTopRefs.current[i] = el;
                                        }}
                                        className="text-[11px] font-medium text-[#8A8474]"
                                    >
                                        {i + 1}
                                    </span>
                                    <span className="text-center text-sm font-bold leading-tight"
                                          style={{color: accent}}>
                                        {item}
                                    </span>
                                    <span
                                        ref={(el) => {
                                            rankBottomRefs.current[i] = el;
                                        }}
                                        className="rotate-180 text-[11px] font-medium text-[#8A8474]"
                                    >
                                        {i + 1}
                                    </span>
                                </div>

                                {/* 뒷면 */}
                                <div
                                    ref={(el) => {
                                        backRefs.current[i] = el;
                                    }}
                                    className="absolute inset-0 flex items-center justify-center rounded-lg border border-zinc-500 opacity-0 shadow transition-[opacity,transform] duration-300"
                                    style={{
                                        transform: 'scaleX(0)',
                                        background: 'repeating-linear-gradient(45deg, #504C58, #504C58 4px, #5E5A66 4px, #5E5A66 8px)',
                                    }}
                                >
                                    <ForkKnifeIcon/>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 결과 칩 */}

                <div className="inline-flex items-center gap-2 bg-[#FDEBE1] border border-[#F6C9B2] rounded-full px-4 py-2 mt-4">
                    <span className="text-[11px] text-[#B7754F] font-bold">오늘의 메뉴</span>
                    <span className="text-[14px] text-[#D2571E] font-extrabold">{result || "-"}</span>
                </div>

            {/* 섞기 / 다시 섞기 버튼 */}
            <button
                onClick={handleShuffle}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full bg-[#24564A] text-white px-8 py-3 my-3 text-[14.5px] font-extrabold shadow-[0_10px_18px_-8px_rgba(36,86,74,0.5)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M4 4l4.5 4.5M15 15l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {busy ? "섞는 중..." : hasPlayed ? "다시 섞기" : "섞기"}
            </button>
        </div>
    );
}