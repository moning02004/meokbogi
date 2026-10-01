// 서버가 주는 "YYYY-MM-DD"를 로컬 자정으로 해석한다.
// new Date("YYYY-MM-DD")는 UTC 자정이라 UTC보다 느린 시간대에서 하루 밀린다.
export const parseLocalDate = (value: string) => {
    const [year, month, day] = value.split("-").map(Number)
    return new Date(year, month - 1, day)
}

// 그 날짜로부터 오늘까지 며칠 지났는지
export const daysSince = (value: string) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return Math.round((today.getTime() - parseLocalDate(value).getTime()) / 86_400_000)
}
