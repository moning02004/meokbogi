type ReviewBoxSize = "sm" | "md"

export const getReviewTextBox = (review_avg: number, size: ReviewBoxSize = "md") => {
    const boxInfo =
        review_avg <= -0.6 ? {color: "bg-bad-soft text-bad", text: "실망"} :
        review_avg <= -0.2 ? {color: "bg-warn-soft text-warn", text: "아쉬움"} :
        review_avg <= 0.2  ? {color: "bg-fill text-ink2", text: "무난"} :
        review_avg <= 0.6  ? {color: "bg-good-soft text-good", text: "좋음"} :
                             {color: "bg-good-soft text-good", text: "만족"}

    const sizeCls = size === "sm"
        ? "text-[11.5px] px-2 py-0.5"
        : "text-[12.5px] px-2.5 py-1"

    return (
        <span className={`inline-flex shrink-0 items-center rounded-[10px] font-bold ${sizeCls} ${boxInfo.color}`}>
            {boxInfo.text}
        </span>
    )
}