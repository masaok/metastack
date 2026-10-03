import { Github } from "lucide-react";

import { cn } from "@/lib/utils";

/** GitHub's third-party sign-in button: octocat mark, near-black fill, 6px corners. */
export function GithubSignIn({
  className,
  labelClassName,
}: {
  className?: string;
  labelClassName?: string;
}) {
  return (
    <a
      href="/api/auth/github"
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#24292f] px-3 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#1b1f23] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24292f] dark:bg-[#f6f8fa] dark:text-[#24292f] dark:hover:bg-white dark:focus-visible:outline-[#f6f8fa]",
        className,
      )}
    >
      <Github className="h-4 w-4 shrink-0" aria-hidden />
      <span className={labelClassName}>Sign in with GitHub</span>
    </a>
  );
}
