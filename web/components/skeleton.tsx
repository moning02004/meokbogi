
export const Skeleton = () => {
    return (
        <div className="flex items-center justify-between py-3.5 pr-3 animate-pulse">
            <div className="flex flex-col gap-2 w-full">
                <div className="h-4 w-2/5 bg-fill-hover rounded"/>
                <div className="h-3 w-3/5 bg-fill rounded"/>
            </div>
        </div>
    )
}
