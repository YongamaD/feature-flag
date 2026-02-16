const colors = {
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
  gray: "bg-gray-100 text-gray-800",
  blue: "bg-blue-100 text-blue-800",
  yellow: "bg-yellow-100 text-yellow-800",
};

interface BadgeProps {
  color?: keyof typeof colors;
  children: React.ReactNode;
}

export function Badge({ color = "gray", children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}
