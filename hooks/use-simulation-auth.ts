import { useUser, useAuth } from "@clerk/nextjs";

export function useSimulationAuth() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken, userId } = useAuth();

  return {
    isLoaded,
    isSignedIn,
    user,
    userId,
    getToken,
  };
}
