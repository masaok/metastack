import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-24 text-center">
      <Logo className="h-24 w-24" />
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-ink">
        That card is not in the deck
      </h1>
      <p className="mt-3 text-ink-2">
        The page you asked for does not exist. Card ids are stable, so if you followed a link from
        somewhere, the card may have been renamed.
      </p>
      <div className="mt-8 flex gap-3">
        <ButtonLink href="/cards" variant="outline">
          Browse cards
        </ButtonLink>
        <ButtonLink href="/study">Start drilling</ButtonLink>
      </div>
    </div>
  );
}
