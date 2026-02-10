import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export type Session = {
  user: {
    id: string;
    email: string;
    name?: string;
    role: string;
    image?: string;
  };
  expires: string;
};

export const auth = async (): Promise<Session | null> => {
  return await getServerSession(authOptions);
};
