interface SettingsCardProps {
    title: string
    icon?: React.ReactNode
    children: React.ReactNode
    className?: string
}

export function SettingsCard({title, icon, children, className = ""}: SettingsCardProps) {
    return (
        <div className={`bg-surface rounded-3xl p-5 ${className}`}>
            <p className="text-[13px] font-semibold text-ink3 mb-3 flex items-center gap-1.5">
                {icon}
                {title}
            </p>
            {children}
        </div>
    )
}
