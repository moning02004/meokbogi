type ReviewBoxSize = "sm" | "md"

export const getReviewTextBox = (review_avg: number, size: ReviewBoxSize = "md") => {
    const boxInfo =
        review_avg <= -0.6 ? {color: "bg-[#FDEBE1] text-[#C23B1E]", text: "실망"} :
        review_avg <= -0.2 ? {color: "bg-[#FBE9DA] text-[#C4703A]", text: "아쉬움"} :
        review_avg <= 0.2  ? {color: "bg-[#F1EFE8] text-[#8A8172]", text: "무난"} :
        review_avg <= 0.6  ? {color: "bg-[#E4EEEA] text-[#24564A]", text: "좋음"} :
                             {color: "bg-[#E4EEEA] text-[#1D7A5F]", text: "최고"}

    const sizeCls = size === "sm"
        ? "text-[11px] px-2 py-0.5"
        : "text-[12px] px-2.5 py-1"

    return (
        <span className={`inline-flex items-center rounded-full font-bold ${sizeCls} ${boxInfo.color}`}>
            {boxInfo.text}
        </span>
    )
}