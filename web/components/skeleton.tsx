
export const Skeleton = () => {
    return (
        <div className="flex items-center justify-between p-2 rounded animate-pulse">
            <div className="flex flex-col gap-2 w-full">
                <div className="h-4 w-2/5 bg-stone-200 rounded"/>
                <div className="h-3 w-3/5 bg-stone-100 rounded"/>
            </div>
        </div>
    )
}
