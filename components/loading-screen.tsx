import { Spinner } from "./ui/spinner";

export function LoadingScreen() {

    return (
        <div className="flex flex-col items-center justify-center h-screen gap-4">
            <Spinner className="size-10 animate-spin" style={{color: "#7C6103"}} />

            <p className="text-sm text-muted-foreground">Powering up Shukra</p>
    </div>
  );
}

