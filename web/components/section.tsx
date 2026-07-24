import React from "react";

interface SectionBoxProps {
    title?: string;
    className?: string;
    isBorder?: boolean;
    isLast?: boolean;
    icon?: React.ReactNode
    children: React.ReactNode
}

export const SectionBox = ({
                               title,
                               className = "",
                               icon,
                               isBorder = false,
                               isLast = false,
                               children
                           }: SectionBoxProps) => {
    if (!className) {
        className = "px-3"
    }
    if (isLast) {
        className = `${className} mb-3`
    }
    if (isBorder) {
        className = `${className} rounded-xl px-2 py-3 border border-stone-300`
    }

    return (
        <div className={className}>
            {title &&
                <div className="text-sm text-stone-600 flex flex-row gap-3 mb-1">
                    {icon && <div className="my-auto">{icon}</div>}
                    <div>{title}</div>
                </div>
            }
            {children}
        </div>
    )
}