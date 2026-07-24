'use client';

import {Dispatch, SetStateAction, useEffect, useRef, useState} from 'react';
import {ACCENT_COLORS, CARD_H, CARD_W, shuffle, wait} from '@/constants/play';
import {ForkKnifeIcon} from "@/components/play/ForkKnifeIcon";

/**
 * FoodCardShuffle
 * - 카드가 판 위에 그리드로 펼쳐져 보이다가 "섞기"를 누르면
 *   뒤집혀서 흩어지고 가운데로 모였다가 다시 그리드로 펼쳐지며
 *   실제로 카드 위치(=순위)가 뒤바뀝니다.
 * - 왼쪽 상단(1번) 자리에 오는 카드가 당첨입니다.
 *
 * 애니메이션 단계상 카드마다 위치(left/top)를 직접 계산해서 옮겨야 해서
 * 좌표 관련 값만 인라인 style로 다루고, 나머지 스타일은 Tailwind로 처리했습니다.
 */

export interface FoodCardShuffleProps {
    categoryInfo: Record<string, number>;
    items: string[];
    trayColor?: string;
    setSelectedCategory: (value: number) => void;
}

type Pos = { x: number; y: number };

export default function FoodCardShuffle({
                                            categoryInfo,
                                            items,
                                            trayColor = '#3C3942',
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
        }
    }

    // 초기 배치 + 리사이즈 대응
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

        const winnerIdx = order[0];
        const front = frontRefs.current[winnerIdx];
        if (front) {
            front.style.borderColor = ACCENT_COLORS[winnerIdx % ACCENT_COLORS.length];
            front.style.borderWidth = '2px';
        }
        const p0 = finalPos[0];
        place(winnerIdx, p0.x, p0.y, 0, 1.1, 10);

        setResult(`${items[winnerIdx]} 당첨!`);
        setSelectedCategory(categoryInfo[items[winnerIdx]])
        setBusy(false);
    }

    function handleShuffle() {
        if (busy) return;
        setBusy(true);
        setResult('');
        for (let i = 0; i < n; i++) resetBorder(i);
        shuffleSequence();
    }

    return (
        <div className="flex flex-col items-center gap-1 pb-4">

            <button
                onClick={handleShuffle}
                disabled={busy}
                className="rounded-lg border border-zinc-300 bg-white px-6 py-2 font-medium disabled:bg-zinc-100 disabled:text-zinc-400"
            >
                섞기
            </button>
            <div className="min-h-[28px] text-lg font-medium text-[#c0703a]">{result}</div>

            <div className="w-full p-5" style={{background: trayColor}}>
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
                                    className="absolute inset-0 flex flex-col items-center justify-between rounded-lg border border-[#E4DCC8] bg-[#FAF6EC] p-1.5 shadow transition-[opacity,transform] duration-300"
                                >
                  <span
                      ref={(el) => {
                          rankTopRefs.current[i] = el;
                      }}
                      className="text-[11px] font-medium text-[#8A8474]"
                  >
                    {i + 1}
                  </span>
                                    <span className="text-center text-sm font-medium leading-tight"
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
        </div>
    );
}