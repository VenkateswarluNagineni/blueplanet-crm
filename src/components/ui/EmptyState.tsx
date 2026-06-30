import React from 'react';

/** A friendly empty/zero-result placeholder: icon, title, hint, and an optional action. */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className = '',
}: {
  icon?: React.ElementType;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-6 gap-2 ${className}`}>
      {Icon && <Icon size={30} className="text-[#454446] mb-1" />}
      <p className="text-[14px] text-white font-medium">{title}</p>
      {hint && <p className="text-[12px] text-[#b8b6b9] max-w-sm">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
