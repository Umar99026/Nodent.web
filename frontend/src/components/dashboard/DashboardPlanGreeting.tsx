import { greetingNameSeparator } from "@/lib/dashboardGreeting";

type DashboardPlanGreetingProps = {
  greeting?: string;
  displayName?: string;
};

export function DashboardPlanGreeting({
  greeting,
  displayName = "Student",
}: DashboardPlanGreetingProps) {
  const welcomeLead = greeting?.trim() ? greeting.trim() : "Hey!";
  const separator = greetingNameSeparator(welcomeLead);

  return (
    <h1 className="font-sans flex min-w-0 flex-wrap items-baseline gap-x-1.5 font-normal leading-[1.15] tracking-[-0.02em]">
      <span className="text-lg font-medium text-[#64748b] sm:text-xl">
        {welcomeLead}
        {separator}
      </span>
      <span className="text-[clamp(1.625rem,4.2vw,2.25rem)] font-semibold tracking-[-0.03em] text-[#0b0f19]">
        {displayName}
      </span>
      <span className="text-lg font-medium text-[#64748b] sm:text-xl">
        here&apos;s your plan for today
      </span>
    </h1>
  );
}
