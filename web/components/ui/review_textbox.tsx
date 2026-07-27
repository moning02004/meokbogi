export const getReviewTextBox = (review_avg: number, ) => {
    const boxInfo = review_avg <= -0.6 ? {color: "border-red-600 bg-red-100 text-red-700", text: "실망이에요"} :
        (-0.6 < review_avg && review_avg <= -0.2) ? {color: "border-orange-600 bg-orange-100 text-orange-700", text: "아쉬워요"} :
            (-0.2 < review_avg && review_avg <= 0.2) ? {color: "border-gray-600 bg-gray-100 text-gray-700", text: "무난해요"} :
                (0.2 < review_avg && review_avg <= 0.6) ? {color: "border-green-600 bg-green-100 text-green-700", text: "좋아요"} :
                    {color: "border-blue-600 bg-blue-100 text-blue-700", text: "만족이에요"}
    return <span className={`text-xs font-medium rounded-full border px-2 py-1 ${boxInfo.color}`}>{boxInfo.text}</span>
}
