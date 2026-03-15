import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="defi-page flex items-center justify-center px-4">
      <SignUp />
    </div>
  );
}
