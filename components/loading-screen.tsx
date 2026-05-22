import { Spinner } from "./ui/spinner";

export function LoadingScreen() {

    return (
        <div className="flex items-center justify-center h-screen">
            <Spinner className="size-10 animate-spin" />
            <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}